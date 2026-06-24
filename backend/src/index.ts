import dotenv from 'dotenv';
if (!process.env.RENDER) {
  dotenv.config();
}

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import paymentRoutes from './routes/paymentRoutes';

const app = express();

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    version: '1.0.3',
    is_render: !!process.env.RENDER,
    render_val: process.env.RENDER,
    node_env: process.env.NODE_ENV,
    db_url_prefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 45) + '...' : 'undefined',
    prod_db_url_prefix: process.env.PROD_DATABASE_URL ? process.env.PROD_DATABASE_URL.substring(0, 45) + '...' : 'undefined'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
