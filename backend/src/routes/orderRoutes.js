const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const orderController = require('../controllers/orderController');

const router = express.Router();

// Sab orders endpoints ke liye auth required
router.use(authMiddleware);

// ---------------- CUSTOMER ROUTES ----------------

// Current user ke saare orders
// GET /api/orders/my
router.get('/my', orderController.getMyOrders);

// ---------------- KITCHEN / ADMIN ROUTES ----------------

// Kitchen dashboard list
// GET /api/orders/kitchen?filter=active|new|completed
router.get(
  '/kitchen',
  authorizeRoles('ADMIN', 'KITCHEN'),
  orderController.getKitchenOrders
);

// Order status update
// PATCH /api/orders/:id/status
router.patch(
  '/:id/status',
  authorizeRoles('ADMIN', 'KITCHEN'),
  orderController.updateOrderStatus
);

// Order delete
// Order delete
// DELETE /api/orders/:id
router.delete(
  '/:id',
  authorizeRoles('ADMIN', 'KITCHEN', 'CUSTOMER'),
  orderController.deleteOrder
);

// Single order details (customer + admin + kitchen)
// GET /api/orders/:id
router.get('/:id', orderController.getOrderById);

// ---------------- CHECKOUT ROUTES ----------------

// Preview (subtotal + delivery + discount + GST)
router.post('/preview', orderController.previewOrder);

// COD order create
router.post('/cod', orderController.createCodOrder);

module.exports = router;