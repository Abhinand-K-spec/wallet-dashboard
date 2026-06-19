import { Response } from 'express';
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

    const deposit = await prisma.walletDeposit.create({
      data: {
        userId: req.user!.id,
        txHash,
        amountUSD: onChainResult.amountUSD,
        walletAddress: onChainResult.fromAddress,
        status: 'PENDING',
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
    const { amountUSD, amountINR, accountHolder, accountNumber, ifsc } = req.body;

    // To prevent withdrawal if user doesn't have enough approved balance,
    // we should calculate their available balance: Total Approved Deposits - Total Withdrawals.
    
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        deposits: { where: { status: 'APPROVED' } },
        withdrawals: { where: { status: { in: ['PENDING', 'APPROVED', 'PAID'] } } },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const totalDeposits = user.deposits.reduce((acc, d) => acc + d.amountUSD, 0);
    const totalWithdrawals = user.withdrawals.reduce((acc, w) => acc + w.amountUSD, 0);
    const availableBalance = totalDeposits - totalWithdrawals;

    if (parseFloat(amountUSD) > availableBalance) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId: req.user!.id,
        amountUSD: parseFloat(amountUSD),
        amountINR: parseFloat(amountINR),
        accountHolder,
        accountNumber,
        ifsc,
        status: 'PENDING',
      },
    });

    res.status(201).json({ message: 'Withdrawal requested successfully', withdrawal });
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
