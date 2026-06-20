import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../prismaClient';
import { verifyOnChainUSDT } from '../utils/blockchain';

export const getDepositAddress = async (req: AuthRequest, res: Response) => {
  try {
    const walletAddress = process.env.ADMIN_WALLET_ADDRESS || '0x1234567890abcdef1234567890abcdef12345678';
    res.json({ walletAddress });
  } catch (error) {
    console.error('Get deposit address error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      include: {
        deposits: true,
        withdrawals: true,
        transactions: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitDeposit = async (req: AuthRequest, res: Response) => {
  try {
    const { txHash, amountUSD } = req.body;
    
    if (!txHash || !amountUSD) {
      return res.status(400).json({ error: 'Transaction hash and amount are required' });
    }

    const existingDeposit = await prisma.walletDeposit.findUnique({ where: { txHash } });
    if (existingDeposit) {
      return res.status(400).json({ error: 'Transaction hash already submitted' });
    }

    const adminWallet = process.env.ADMIN_WALLET_ADDRESS || '0x1234567890abcdef1234567890abcdef12345678';
    const onChainResult = await verifyOnChainUSDT(txHash, adminWallet);

    if (!onChainResult.success) {
      return res.status(400).json({ error: `Blockchain verification failed: ${onChainResult.message}` });
    }

    // Fetch USD_INR_RATE
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'USD_INR_RATE' }
    });
    const rate = setting ? parseFloat(setting.value) : 83.50;
    const equivalentINR = onChainResult.amountUSD * rate;

    const deposit = await prisma.walletDeposit.create({
      data: {
        userId: req.user!.id,
        txHash,
        amountUSD: onChainResult.amountUSD,
        equivalentINR,
        adminEnteredRate: rate,
        walletAddress: onChainResult.fromAddress,
        status: 'PENDING',
        onChainVerified: true,
        onChainNetwork: onChainResult.network,
        onChainFrom: onChainResult.fromAddress,
        onChainTo: onChainResult.toAddress,
        onChainAmount: onChainResult.amountUSD,
        onChainTxHash: onChainResult.txHash || txHash,
      },
    });

    res.status(201).json({ message: 'Deposit submitted and blockchain verified successfully', deposit });
  } catch (error) {
    console.error('Submit deposit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requestWithdrawal = async (req: AuthRequest, res: Response) => {
  try {
    const { method: reqMethod, amountUSD, amountINR, accountHolder, accountNumber, ifsc, walletAddress } = req.body;
    const method = reqMethod || 'BANK';

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        deposits: { where: { status: 'APPROVED' } },
        withdrawals: { where: { status: { in: ['PENDING', 'APPROVED', 'PAID'] } } },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Calculate balance in INR
    const totalDepositsINR = user.deposits.reduce((acc, d) => {
      return acc + (d.equivalentINR ?? (d.amountUSD * (d.adminEnteredRate ?? 83.50)));
    }, 0);
    const totalWithdrawalsINR = user.withdrawals.reduce((acc, w) => acc + w.amountINR, 0);
    const availableBalanceINR = totalDepositsINR - totalWithdrawalsINR;

    // Get active exchange rate
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'USD_INR_RATE' }
    });
    const rate = setting ? parseFloat(setting.value) : 83.50;

    let finalAmountUSD = 0;
    let finalAmountINR = 0;

    if (method === 'BANK') {
      if (!amountINR || isNaN(parseFloat(amountINR)) || parseFloat(amountINR) <= 0) {
        return res.status(400).json({ error: 'Withdrawal amount in INR must be greater than 0' });
      }
      if (!accountHolder || !accountNumber || !ifsc) {
        return res.status(400).json({ error: 'Account holder, account number, and IFSC are required for bank withdrawals' });
      }
      if (!/^[a-zA-Z\s.]{3,60}$/.test(accountHolder.trim())) {
        return res.status(400).json({ error: 'Invalid account holder name. Minimum 3 characters, alphabets and spaces only' });
      }
      if (!/^\d{9,18}$/.test(accountNumber)) {
        return res.status(400).json({ error: 'Invalid bank account number. Must be between 9 and 18 digits' });
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase())) {
        return res.status(400).json({ error: 'Invalid IFSC code format (e.g. HDFC0001234)' });
      }

      finalAmountINR = parseFloat(amountINR);
      if (finalAmountINR > availableBalanceINR) {
        return res.status(400).json({ 
          error: `Insufficient balance. Available: ₹${availableBalanceINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR` 
        });
      }
      finalAmountUSD = finalAmountINR / rate;

      const withdrawal = await prisma.withdrawal.create({
        data: {
          userId: req.user!.id,
          method: 'BANK',
          amountUSD: finalAmountUSD,
          amountINR: finalAmountINR,
          accountHolder,
          accountNumber,
          ifsc,
          status: 'PENDING',
        },
      });

      return res.status(201).json({ message: 'Withdrawal requested successfully', withdrawal });
    } else if (method === 'USDT') {
      if (!amountUSD || isNaN(parseFloat(amountUSD)) || parseFloat(amountUSD) <= 0) {
        return res.status(400).json({ error: 'Withdrawal amount in USDT must be greater than 0' });
      }
      if (!accountHolder || !walletAddress) {
        // accountHolder is used as the Name for USDT withdrawal
        return res.status(400).json({ error: 'Recipient name and wallet address are required for USDT withdrawals' });
      }
      if (!/^[a-zA-Z\s.]{3,60}$/.test(accountHolder.trim())) {
        return res.status(400).json({ error: 'Invalid recipient name. Minimum 3 characters, alphabets and spaces only' });
      }
      const isTrc20 = /^T[a-zA-Z0-9]{33}$/.test(walletAddress);
      const isErc20 = /^0x[a-fA-F0-9]{40}$/.test(walletAddress);
      if (!isTrc20 && !isErc20) {
        return res.status(400).json({ error: 'Invalid USDT wallet address. Must be a valid TRC20 (starts with T) or ERC20 (starts with 0x) address' });
      }

      finalAmountUSD = parseFloat(amountUSD);
      finalAmountINR = finalAmountUSD * rate;
      if (finalAmountINR > availableBalanceINR) {
        return res.status(400).json({ 
          error: `Insufficient balance. Available: ₹${availableBalanceINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR (approx. $${(availableBalanceINR / rate).toFixed(2)} USDT)` 
        });
      }

      const withdrawal = await prisma.withdrawal.create({
        data: {
          userId: req.user!.id,
          method: 'USDT',
          amountUSD: finalAmountUSD,
          amountINR: finalAmountINR,
          accountHolder,
          walletAddress,
          status: 'PENDING',
        },
      });

      return res.status(201).json({ message: 'Withdrawal requested successfully', withdrawal });
    } else {
      return res.status(400).json({ error: 'Invalid withdrawal method' });
    }
  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });

    const deposits = await prisma.walletDeposit.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });

    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ transactions, deposits, withdrawals });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getExchangeRate = async (req: Request, res: Response) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'USD_INR_RATE' }
    });

    const rate = setting ? parseFloat(setting.value) : 83.50; // Default fallback

    res.json({ rate });
  } catch (error) {
    console.error('Get exchange rate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
