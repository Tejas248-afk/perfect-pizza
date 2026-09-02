const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController');
const couponAdminController = require('../controllers/couponAdminController'); 

const router = express.Router();

// Saare admin routes ke liye:
// 1) Auth required
// 2) Role = ADMIN required
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN'));

// ---------- Overview ----------
router.get('/overview', adminController.getOverview);

// ---------- Orders ----------
router.get('/orders', adminController.getOrders);

// ---------- Customers ----------
router.get('/customers', adminController.getCustomers);

// ---------- Delivery Rules ----------
router.get('/delivery-rules', adminController.getDeliveryRules);
router.post('/delivery-rules', adminController.createDeliveryRule);
router.put('/delivery-rules/:id', adminController.updateDeliveryRule);
router.patch(
  '/delivery-rules/:id/toggle',
  adminController.toggleDeliveryRule
);

// ---------- Products (Menu Items) ----------
router.get('/products', productController.getAllProductsAdmin);
router.post('/products', productController.createProduct);
router.put('/products/:id', productController.updateProduct);
router.patch(
  '/products/:id/availability',
  productController.updateAvailability
);
router.delete('/products/:id', productController.softDeleteProduct);

// ---------- Coupons ----------
router.get('/coupons', couponAdminController.getCoupons);
router.post('/coupons', couponAdminController.createCoupon);
router.put('/coupons/:id', couponAdminController.updateCoupon);
router.patch('/coupons/:id/toggle', couponAdminController.toggleCoupon);

module.exports = router;