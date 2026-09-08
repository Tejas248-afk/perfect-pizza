// backend/src/routes/couponPublicRoutes.js
const express = require('express');
const router = express.Router();

const couponPublicController = require('../controllers/couponPublicController');

// PUBLIC route (no auth) to get currently active coupons
router.get('/active', couponPublicController.getActiveCoupons);

module.exports = router;