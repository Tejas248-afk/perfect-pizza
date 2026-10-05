// src/routes/adminOutletRoutes.js
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const adminOutletController = require('../controllers/adminOutletController');

const router = express.Router();

// Auth + ADMIN/SUPER_ADMIN
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN', 'SUPER_ADMIN'));

router.get('/', adminOutletController.listOutlets);

module.exports = router;
