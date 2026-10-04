// src/routes/adminUserRoutes.js
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const adminUserController = require('../controllers/adminUserController');

const router = express.Router();

// Auth + ADMIN / SUPER_ADMIN
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN', 'SUPER_ADMIN'));

router.get('/', adminUserController.listUsers);
router.patch('/:id/role', adminUserController.updateUserRole);

module.exports = router;