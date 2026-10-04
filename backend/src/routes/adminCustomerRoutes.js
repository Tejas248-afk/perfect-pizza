// src/routes/adminCustomerRoutes.js
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const adminCustomerController = require('../controllers/adminCustomerController');

const router = express.Router();

// Auth + ADMIN only
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN'));

router.get('/', adminCustomerController.getCustomersSummary);
router.get('/:id', adminCustomerController.getCustomerProfile);

module.exports = router;