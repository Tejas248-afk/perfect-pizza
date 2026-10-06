// src/routes/adminReportRoutes.js
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const adminReportController = require('../controllers/adminReportController');

const router = express.Router();

// Sirf logged-in ADMIN / SUPER_ADMIN
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN', 'SUPER_ADMIN'));

// Sales Trend (daily / weekly / monthly / yearly)
router.get('/sales-trend', adminReportController.getSalesTrend);

// Peak Hour (per hour buckets)
router.get('/peak-hours', adminReportController.getPeakHours);

// Customer summary report
router.get('/customers', adminReportController.getCustomerReport);

// Customer retention (month-wise)
router.get(
  '/customers/retention',
  adminReportController.getCustomerRetention
);

module.exports = router;