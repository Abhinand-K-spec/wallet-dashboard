import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../prismaClient';
import { getWalletOnChainDetails, getOnChainTransactions } from '../utils/blockchain';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const totalUsers = await prisma.user.count({ where: { role: 'USER' } });
    
    const deposits = await prisma.walletDeposit.findMany({ where: { status: 'APPROVED' } });
    const totalDepositsUSD = deposits.reduce((acc, d) => acc + d.amountUSD, 0);

    const withdrawals = await prisma.withdrawal.findMany({ where: { status: 'PAID' } });
    const totalWithdrawalsINR = withdrawals.reduce((acc, w) => acc + w.amountINR, 0);

    const pendingDeposits = await prisma.walletDeposit.count({ where: { status: 'PENDING' } });
    const pendingWithdrawals = await prisma.withdrawal.count({ where: { status: 'PENDING' } });

    const adminWalletAddress = process.env.ADMIN_WALLET_ADDRESS || '';
    let ethBalance = 0;
    let usdtBalance = 0;
    let onChainTransactions: any[] = [];

    if (adminWalletAddress) {
      try {
        const [details, txs] = await Promise.all([
          getWalletOnChainDetails(adminWalletAddress),
          getOnChainTransactions(adminWalletAddress)
        ]);
        ethBalance = details.ethBalance;
        usdtBalance = details.usdtBalance;
        onChainTransactions = txs;
      } catch (err) {
        console.error('Error fetching admin wallet details:', err);
      }
    }

    res.json({
      totalUsers,
      totalDepositsUSD,
      totalWithdrawalsINR,
      pendingRequests: pendingDeposits + pendingWithdrawals,
      walletDetails: {
        address: adminWalletAddress,
        ethBalance,
        usdtBalance,
        etherscanConfigured: !!(process.env.ETHERSCAN_API_KEY && process.env.ETHERSCAN_API_KEY !== 'YOUR_API_KEY_HERE'),
        onChainTransactions
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllDeposits = async (req: AuthRequest, res: Response) => {
  try {
    const deposits = await prisma.walletDeposit.findMany({
      include: { user: { select: { email: true, userId: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(deposits);
  } catch (error) {
    console.error('Get all deposits error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllWithdrawals = async (req: AuthRequest, res: Response) => {
  try {
    const withdrawals = await prisma.withdrawal.findMany({
      include: { user: { select: { email: true, userId: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(withdrawals);
  } catch (error) {
    console.error('Get all withdrawals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyDeposit = async (req: AuthRequest, res: Response) => {
  try {
    const { depositId } = req.params;
    const { action, adminEnteredRate } = req.body; // action: 'APPROVED' | 'REJECTED'

    const deposit = await prisma.walletDeposit.findUnique({ where: { id: String(depositId) } });
    if (!deposit) return res.status(404).json({ error: 'Deposit not found' });

    if (deposit.status !== 'PENDING') {
      return res.status(400).json({ error: 'Deposit already processed' });
    }

    const rateFloat = adminEnteredRate ? parseFloat(adminEnteredRate) : null;
    const equivalentINR = (action === 'APPROVED' && rateFloat) ? deposit.amountUSD * rateFloat : null;

    const updatedDeposit = await prisma.walletDeposit.update({
      where: { id: String(depositId) },
      data: {
        status: action,
        adminEnteredRate: (action === 'APPROVED' && rateFloat) ? rateFloat : null,
        equivalentINR,
      },
    });

    if (action === 'APPROVED') {
      await prisma.transaction.create({
        data: {
          userId: deposit.userId,
          transactionType: 'DEPOSIT',
          amountUSD: deposit.amountUSD,
          amountINR: equivalentINR,
          reference: deposit.id,
          status: 'COMPLETED',
        },
      });
    }

    await prisma.adminAction.create({
      data: {
        adminId: req.user!.id,
        action: `${action}_DEPOSIT`,
        targetId: deposit.id,
      },
    });

    res.json({ message: `Deposit ${action.toLowerCase()} successfully`, deposit: updatedDeposit });
  } catch (error) {
    console.error('Verify deposit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const manageWithdrawal = async (req: AuthRequest, res: Response) => {
  try {
    const { withdrawalId } = req.params;
    const { action, utr } = req.body; // action: 'APPROVED' | 'REJECTED' | 'PAID'

    const withdrawal = await prisma.withdrawal.findUnique({ where: { id: String(withdrawalId) } });
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });

    if (action === 'PAID' && !utr) {
      return res.status(400).json({ error: 'UTR number required to mark as PAID' });
    }

    const updatedWithdrawal = await prisma.withdrawal.update({
      where: { id: String(withdrawalId) },
      data: {
        status: action,
        approvedBy: req.user!.id,
        utr: action === 'PAID' ? utr : withdrawal.utr,
      },
    });

    if (action === 'PAID') {
      await prisma.transaction.create({
        data: {
          userId: withdrawal.userId,
          transactionType: 'WITHDRAWAL',
          amountUSD: withdrawal.amountUSD,
          amountINR: withdrawal.amountINR,
          reference: withdrawal.id,
          status: 'COMPLETED',
        },
      });
    }

    await prisma.adminAction.create({
      data: {
        adminId: req.user!.id,
        action: `${action}_WITHDRAWAL`,
        targetId: withdrawal.id,
      },
    });

    res.json({ message: `Withdrawal ${action.toLowerCase()} successfully`, withdrawal: updatedWithdrawal });
  } catch (error) {
    console.error('Manage withdrawal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { search, status, role, page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { userId: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (status && (status === 'ACTIVE' || status === 'SUSPENDED')) {
      whereClause.status = status;
    }

    if (role && (role === 'USER' || role === 'ADMIN')) {
      whereClause.role = role;
    }

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          userId: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.user.count({ where: whereClause })
    ]);

    res.json({
      users,
      totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum)
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const toggleUserStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (id === req.user?.id) {
      return res.status(400).json({ error: 'You cannot suspend your own admin account.' });
    }

    const user = await prisma.user.findUnique({ where: { id: id as string } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';

    const updatedUser = await prisma.user.update({
      where: { id: id as string },
      data: { status: newStatus },
      select: {
        id: true,
        userId: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Log the admin action
    await prisma.adminAction.create({
      data: {
        adminId: req.user!.id,
        action: newStatus === 'SUSPENDED' ? 'SUSPENDED_USER' : 'ACTIVATED_USER',
        targetId: user.id
      }
    });

    res.json({
      message: `User status successfully updated to ${newStatus.toLowerCase()}`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

