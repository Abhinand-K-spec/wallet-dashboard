import { Router } from 'express';
import { getProfile, submitDeposit, requestWithdrawal, getTransactions, getDepositAddress } from '../controllers/userController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/profile', getProfile);
router.get('/deposit-address', getDepositAddress);
router.get('/transactions', getTransactions);
router.post('/deposit', submitDeposit);
router.post('/withdraw', requestWithdrawal);

export default router;
