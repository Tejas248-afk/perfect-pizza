// src/routes/adminComboRoutes.js
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const adminComboController = require('../controllers/adminComboController');

const router = express.Router();

// Auth + ADMIN/SUPER_ADMIN
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN', 'SUPER_ADMIN'));

router.get('/', adminComboController.listCombos);
router.post('/', adminComboController.createCombo);
router.patch('/:id', adminComboController.updateCombo);
router.delete('/:id', adminComboController.deleteCombo);

module.exports = router;