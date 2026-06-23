import { Router } from 'express';
import { createPaymentOrder, getPaymentOrderStatus } from '../controllers/paymentController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Protect all payment routes with token authentication
router.use(authenticate);

router.post('/create', createPaymentOrder);
router.get('/status/:orderId', getPaymentOrderStatus);

export default router;
