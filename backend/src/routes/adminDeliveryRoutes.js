// src/routes/adminDeliveryRoutes.js
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const adminDeliveryController = require('../controllers/adminDeliveryController');

const router = express.Router();

// Auth + ADMIN only
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN'));

router.get('/zones', adminDeliveryController.listZones);
router.post('/zones', adminDeliveryController.createZone);
router.patch('/zones/:id', adminDeliveryController.updateZone);
router.delete('/zones/:id', adminDeliveryController.deleteZone);

module.exports = router;