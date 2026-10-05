// src/routes/adminActivityRoutes.js
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const adminActivityController = require('../controllers/adminActivityController');

const router = express.Router();

// Auth + ADMIN / SUPER_ADMIN
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN', 'SUPER_ADMIN'));

router.get('/', adminActivityController.listActivity);

module.exports = router;