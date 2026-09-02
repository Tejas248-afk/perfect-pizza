const express = require('express');
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');

const router = express.Router();

// Public: customer side
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

// Admin only: product management
router.post(
  '/',
  authMiddleware,
  authorizeRoles('ADMIN'),
  productController.createProduct
);

router.put(
  '/:id',
  authMiddleware,
  authorizeRoles('ADMIN'),
  productController.updateProduct
);

router.patch(
  '/:id/availability',
  authMiddleware,
  authorizeRoles('ADMIN'),
  productController.updateAvailability
);

module.exports = router;