require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./src/config/db');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const rewardRoutes = require('./src/routes/rewardRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const couponPublicRoutes = require('./routes/couponPublicRoutes');

// PayU controller + auth middleware ko direct yahan use karenge
const paymentController = require('./src/controllers/paymentController');
const authMiddleware = require('./src/middleware/authMiddleware');

const { initSocket } = require('./src/sockets/socket');

const app = express();
const server = http.createServer(app);

// ---------- Global Middlewares (ROUTES SE PEHLE) ----------

// Basic security headers
app.use(helmet());

// MOST IMPORTANT: body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS – frontend localhost allow
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5500',
  'http://127.0.0.1:5500'
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // Postman, curl etc.
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, true); // dev ke liye open
    },
    credentials: true
  })
);

// Logging
app.use(morgan('dev'));

// Generic rate limiter for /api
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

// ---------- MongoDB connect ----------
connectDB();

// ---------- Routes & Endpoints ----------


app.get('/', (req, res) => {
  res.send('Perfect Pizza backend running. Try /api/health');
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Perfect Pizza API working',
    time: new Date().toISOString()
  });
});

// OPTIONAL: root path pe simple message
app.get('/', (req, res) => {
  res.send('Perfect Pizza backend running. Try /api/health');
});

// Auth routes
app.use('/api/auth', authRoutes);

// Product routes (menu)
app.use('/api/products', productRoutes);

// Order routes
app.use('/api/orders', orderRoutes);

// Reward routes
app.use('/api/rewards', rewardRoutes);

app.use('/api/coupons', couponPublicRoutes);


// Admin routes
app.use('/api/admin', adminRoutes);

// ---------- PayU Payment Routes (DIRECT) ----------

// Online payment start (user authenticated)
app.post(
  '/api/payment/payu/init',
  authMiddleware,
  paymentController.initPayuPayment
);

// PayU callback (no auth, PayU call karega)
app.post('/api/payment/payu/callback', paymentController.handlePayuCallback);

// ---------- Socket.IO init ----------
initSocket(server);

// 404 for unknown /api routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res
    .status(err.status || 500)
    .json({ message: err.message || 'Server error. Please try again later.' });
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Perfect Pizza backend running on port ${PORT}`);
});