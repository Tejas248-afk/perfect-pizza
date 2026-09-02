// src/routes/paymentRoutes.js
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

// Online payment start (user authenticated)
router.post(
  '/payu/init',
  authMiddleware,
  paymentController.initPayuPayment
);

// PayU callback (no auth, PayU call karega)
router.post('/payu/callback', paymentController.handlePayuCallback);

module.exports = router;