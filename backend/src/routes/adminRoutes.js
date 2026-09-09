// src/routes/adminRoutes.js
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController');
const couponAdminController = require('../controllers/couponAdminController');
const outletAdminController = require('../controllers/outletAdminController');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Saare admin routes ke liye:
// 1) Auth required
// 2) Role = ADMIN required
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN'));

// ---------- Overview ----------
router.get('/overview', adminController.getOverview);

// ---------- Outlet config (timing + settings) ----------
router.get('/outlet', outletAdminController.getOutletConfig);
router.put('/outlet', outletAdminController.updateOutletConfig);

// ---------- Outlets (multi-outlet) ----------
// Navbar dropdown (active outlets only)
router.get('/outlets', outletAdminController.listOutlets);

// Outlets management page (all outlets)
router.get('/outlets/manage', outletAdminController.getAllOutletsAdmin);
router.post('/outlets', outletAdminController.createOutlet);
router.put('/outlets/:id', outletAdminController.updateOutlet);
router.patch(
  '/outlets/:id/toggle-active',
  outletAdminController.toggleOutletActive
);

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

// Create product WITH image file (multipart/form-data)
router.post(
  '/products',
  upload.single('image'),
  productController.createProduct
);

// Update product WITH optional new image file
router.put(
  '/products/:id',
  upload.single('image'),
  productController.updateProduct
);

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