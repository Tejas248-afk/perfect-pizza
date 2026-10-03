// src/routes/adminOfferRoutes.js
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const offerController = require('../controllers/offerController');

const router = express.Router();

// Sab offers routes: auth + ADMIN only
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN'));

router.get('/', offerController.listOffers);
router.post('/', offerController.createOffer);
router.patch('/:id', offerController.updateOffer);
router.delete('/:id', offerController.deleteOffer);

module.exports = router;