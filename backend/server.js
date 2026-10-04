// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const connectDB = require('./src/config/db');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const rewardRoutes = require('./src/routes/rewardRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const productRoutes = require('./src/routes/productRoutes');
const adminOfferRoutes = require('./src/routes/adminOfferRoutes'); // 👈 yahan src se import
const adminCustomerRoutes = require('./src/routes/adminCustomerRoutes'); // 👈 new
const adminDeliveryRoutes = require('./src/routes/adminDeliveryRoutes'); // 👈 new



// PayU controller + auth middleware
const paymentController = require('./src/controllers/paymentController');
const authMiddleware = require('./src/middleware/authMiddleware');

const { initSocket } = require('./src/sockets/socket');

const app = express();
const server = http.createServer(app);

/* ---------- GLOBAL MIDDLEWARES (ROUTES SE PEHLE) ---------- */

// 1) Render / proxy ke peeche ho to trust proxy ON karo
//    Isse express-rate-limit ka X-Forwarded-For wala error fix hota hai
app.set('trust proxy', 1);

// 2) Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3) CORS
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5500',
  'http://127.0.0.1:5500'
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // Postman, curl etc.
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Dev ke liye abhi open allow kar rahe hain:
      return callback(null, true);
    },
    credentials: true
  })
);

// 4) Static uploads (product images) – sabse pehle register karo
//    Taki yahan koi CORP / COEP apply na ho.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 5) Helmet – BUT all cross‑origin resource policies OFF
//    Taaki images dusre origin se bhi load ho saken.
app.use(
  helmet({
    crossOriginResourcePolicy: false,     // CORP off
    crossOriginEmbedderPolicy: false,     // COEP off
    crossOriginOpenerPolicy: false        // COOP off
  })
);

// 6) Logging
app.use(morgan('dev'));

// 7) Rate limiter for /api (with exceptions)
//    + express-rate-limit ke X-Forwarded-For validation ko off kar diya.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,                // har IP ke liye 15 min me 1000 requests
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    // X-Forwarded-For header aata hai (Render proxy se),
    // lekin agar kabhi trust proxy mismatch ho bhi jaye to error throw na ho:
    xForwardedForHeader: false
  }
});

// Kuch routes ko limiter se bahar rakhne ke liye custom wrapper
app.use('/api', (req, res, next) => {
  const reqPath = req.path || '';

  // Kitchen orders list → polling + socket
  if (reqPath.startsWith('/orders/kitchen')) {
    return next();
  }

  // Single order detail (customer invoice / success page)
  if (reqPath.startsWith('/orders/') && req.method === 'GET') {
    return next();
  }

  // Health check
  if (reqPath.startsWith('/health')) {
    return next();
  }

  return apiLimiter(req, res, next);
});

/* ---------- MongoDB connect ---------- */
connectDB();

/* ---------- Routes & Endpoints ---------- */

// Root check
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

// Auth routes
app.use('/api/auth', authRoutes);

// Product routes (menu)
app.use('/api/products', productRoutes);

// Order routes
app.use('/api/orders', orderRoutes);

// Reward routes
app.use('/api/rewards', rewardRoutes);

// Offers routes (ADMIN)
app.use('/api/admin/offers', adminOfferRoutes);

// Customers routes (ADMIN)
app.use('/api/admin/customers', adminCustomerRoutes);

// Admin routes (other admin stuff)
app.use('/api/admin', adminRoutes);

// Delivery routes (ADMIN)
app.use('/api/admin/delivery', adminDeliveryRoutes);

/* ---------- PayU Payment Routes (DIRECT) ---------- */

// Online payment start (user authenticated)
app.post(
  '/api/payment/payu/init',
  authMiddleware,
  paymentController.initPayuPayment
);

// PayU callback (no auth, PayU call karega)
app.post('/api/payment/payu/callback', paymentController.handlePayuCallback);

/* ---------- Socket.IO init ---------- */
initSocket(server);

/* ---------- 404 for unknown /api routes ---------- */
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

/* ---------- Global error handler ---------- */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res
    .status(err.status || 500)
    .json({ message: err.message || 'Server error. Please try again later.' });
});

/* ---------- Start Server ---------- */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Perfect Pizza backend running on port ${PORT}`);
});