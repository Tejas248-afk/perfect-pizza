// backend/src/routes/couponPublicRoutes.js
const express = require('express');
const router = express.Router();

const couponPublicController = require('../controllers/couponPublicController');

// PUBLIC: GET /api/coupons/active
router.get('/active', couponPublicController.getActiveCoupons);

module.exports = router;