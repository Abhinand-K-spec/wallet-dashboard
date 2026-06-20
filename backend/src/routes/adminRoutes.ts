import { Router } from 'express';
import { 
  getDashboardStats, 
  getAllDeposits, 
  getAllWithdrawals, 
  verifyDeposit, 
  manageWithdrawal,
  getAllUsers,
  toggleUserStatus,
  updateExchangeRate,
  getDepositBlockchainStatus,
  markWithdrawalsDownloaded
} from '../controllers/adminController';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/deposits', getAllDeposits);
router.get('/withdrawals', getAllWithdrawals);
router.post('/deposit/:depositId/verify', verifyDeposit);
router.get('/deposit/:depositId/blockchain-status', getDepositBlockchainStatus);
router.post('/withdrawal/:withdrawalId/manage', manageWithdrawal);
router.post('/withdrawals/mark-downloaded', markWithdrawalsDownloaded);

router.get('/users', getAllUsers);
router.post('/user/:id/toggle-status', toggleUserStatus);
router.post('/settings/rate', updateExchangeRate);

export default router;
