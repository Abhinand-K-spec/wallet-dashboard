import { Router } from 'express';
import { 
  getDashboardStats, 
  getAllDeposits, 
  getAllWithdrawals, 
  verifyDeposit, 
  manageWithdrawal,
  getAllUsers,
  toggleUserStatus
} from '../controllers/adminController';
import { authenticate, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/deposits', getAllDeposits);
router.get('/withdrawals', getAllWithdrawals);
router.post('/deposit/:depositId/verify', verifyDeposit);
router.post('/withdrawal/:withdrawalId/manage', manageWithdrawal);

router.get('/users', getAllUsers);
router.post('/user/:id/toggle-status', toggleUserStatus);

export default router;
