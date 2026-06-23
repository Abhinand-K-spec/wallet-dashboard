import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../prismaClient';
import { getOnChainTransactions } from '../utils/blockchain';

/**
 * POST /api/payments/create
 * Creates a dynamic payment order.
 */
export const createPaymentOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { amount, currency } = req.body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid payment amount greater than 0 is required.' });
    }

    if (!currency || !['USDT', 'INR'].includes(currency)) {
      return res.status(400).json({ error: 'Invalid currency. Must be USDT or INR.' });
    }

    const numAmount = Number(amount);

    // Fetch live USD_INR_RATE
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'USD_INR_RATE' }
    });
    const rate = setting ? parseFloat(setting.value) : 83.50;

    let amountUSD = 0;
    let equivalentINR = 0;

    if (currency === 'INR') {
      amountUSD = Number((numAmount / rate).toFixed(2));
      equivalentINR = numAmount;
    } else {
      amountUSD = numAmount;
      equivalentINR = Number((numAmount * rate).toFixed(2));
    }

    const adminWalletAddress = process.env.ADMIN_WALLET_ADDRESS || 'TD2vA4e994Ki6VBfYUKGmKobXPry3NHf8J';
    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // Generate tron:RECEIVER_ADDRESS?amount=USER_AMOUNT&contract=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
    const qrPayload = `tron:${adminWalletAddress}?amount=${amountUSD.toFixed(2)}&contract=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`;

    // Create the PENDING payment in WalletDeposit table
    const deposit = await prisma.walletDeposit.create({
      data: {
        userId: req.user!.id,
        amountUSD,
        equivalentINR,
        adminEnteredRate: rate,
        status: 'PENDING',
        orderId,
        network: 'TRC20',
        currency,
        expiresAt,
        qrPayload,
      }
    });

    res.status(201).json({
      orderId: deposit.orderId,
      walletAddress: adminWalletAddress,
      amount: amountUSD.toFixed(2),
      network: 'TRC20',
      qrPayload: deposit.qrPayload,
      expiresAt: deposit.expiresAt,
    });
  } catch (error) {
    console.error('Create payment order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/payments/status/:orderId
 * Verifies payment against recent on-chain transactions and updates status.
 */
export const getPaymentOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.walletDeposit.findUnique({
      where: { orderId: String(orderId) }
    });

    if (!order) {
      return res.status(404).json({ error: 'Payment order not found.' });
    }

    // If already verified or approved, return success
    if (order.status === 'SUCCESS' || order.status === 'APPROVED') {
      return res.json({
        status: 'SUCCESS',
        orderId: order.orderId,
        amount: order.amountUSD.toFixed(2),
        txHash: order.txHash,
      });
    }

    // Check if expired
    if (order.status === 'EXPIRED' || (order.expiresAt && new Date() > new Date(order.expiresAt))) {
      if (order.status !== 'EXPIRED') {
        await prisma.walletDeposit.update({
          where: { id: order.id },
          data: { status: 'EXPIRED' }
        });
      }
      return res.json({
        status: 'EXPIRED',
        orderId: order.orderId,
        amount: order.amountUSD.toFixed(2),
      });
    }

    // Run on-chain verification
    const adminWalletAddress = process.env.ADMIN_WALLET_ADDRESS || 'TD2vA4e994Ki6VBfYUKGmKobXPry3NHf8J';
    const transactions = await getOnChainTransactions(adminWalletAddress);

    // Look for a matching transaction
    // Criteria:
    // 1. Recipient matches admin address
    // 2. Amount matches (within 0.01 tolerance)
    // 3. Network/Token matches TRC20/USDT (checked by getOnChainTransactions returning token transactions)
    // 4. Timestamp is after order creation (with small buffer for clock skew)
    // 5. TxHash has not been claimed/used by any other order
    const match = await findMatchingOnChainTx(transactions, order, adminWalletAddress);

    if (match) {
      // 1. Update order status to SUCCESS
      const updatedDeposit = await prisma.walletDeposit.update({
        where: { id: order.id },
        data: {
          status: 'SUCCESS',
          txHash: match.hash,
          onChainVerified: true,
          onChainNetwork: 'TRON_GRID',
          onChainFrom: match.from,
          onChainTo: match.to,
          onChainAmount: match.amountUSD,
          onChainTxHash: match.hash,
        }
      });

      // 2. Create the Ledger Transaction to credit balance
      await prisma.transaction.create({
        data: {
          userId: order.userId,
          transactionType: 'DEPOSIT',
          amountUSD: order.amountUSD,
          amountINR: order.equivalentINR,
          reference: order.id,
          status: 'COMPLETED',
        }
      });

      return res.json({
        status: 'SUCCESS',
        orderId: order.orderId,
        amount: order.amountUSD.toFixed(2),
        txHash: match.hash,
      });
    }

    // Still pending
    return res.json({
      status: 'PENDING',
      orderId: order.orderId,
      amount: order.amountUSD.toFixed(2),
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Scans recent blockchain transactions for one matching the order parameters.
 */
async function findMatchingOnChainTx(transactions: any[], order: any, adminWalletAddress: string) {
  for (const tx of transactions) {
    // 1. Recipient address verification
    if (tx.to.toLowerCase() !== adminWalletAddress.toLowerCase()) {
      continue;
    }

    // 2. Amount match within 0.01 tolerance
    const amountDifference = Math.abs(tx.amountUSD - order.amountUSD);
    if (amountDifference > 0.01) {
      continue;
    }

    // 3. Time window check (transaction should be created around or after order creation)
    // Buffer for clock drift: 2 minutes (120,000ms)
    const orderCreatedAtMs = new Date(order.createdAt).getTime();
    if (tx.timestamp < (orderCreatedAtMs - 120000)) {
      continue;
    }

    // 4. Token check (must be USDT or TRC20)
    const isUSDT = tx.tokenSymbol === 'USDT' || tx.tokenSymbol === 'TRC20';
    if (!isUSDT) {
      continue;
    }

    // 5. Unclaimed check: verify no other deposit already claimed this transaction hash
    const claimed = await prisma.walletDeposit.findFirst({
      where: {
        txHash: tx.hash,
        NOT: { id: order.id }
      }
    });

    if (!claimed) {
      return tx; // Found a match!
    }
  }

  return null;
}
