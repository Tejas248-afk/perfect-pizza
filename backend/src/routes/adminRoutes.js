// src/routes/adminRoutes.js
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController');
const outletAdminController = require('../controllers/outletAdminController');
const categoryAdminController = require('../controllers/categoryAdminController');
const settingsAdminController = require('../controllers/settingsAdminController');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Saare admin routes ke liye:
// 1) Auth required
// 2) Role = ADMIN required
router.use(authMiddleware);
router.use(authorizeRoles('ADMIN'));

// ---------- Overview ----------
router.get('/overview', adminController.getOverview);

// ---------- Analytics ----------
router.get('/analytics/summary', adminController.getAnalyticsSummary);
router.get('/analytics/top-products', adminController.getAnalyticsTopProducts);
router.get('/analytics/top-customers', adminController.getAnalyticsTopCustomers);
router.get(
  '/analytics/orders-by-hour',
  adminController.getAnalyticsOrdersByHour
);

// ---------- Site Settings ----------
router.get('/settings/site', settingsAdminController.getSiteSettings);
router.put('/settings/site', settingsAdminController.updateSiteSettings);

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

// NOTE: frontend admin.js handleToggleOutletActive() hit karta hai /outlets/:id/toggle
// isliye yahan 2 routes rakhe hain same handler ke saath:
router.patch(
  '/outlets/:id/toggle-active',
  outletAdminController.toggleOutletActive
);
router.patch(
  '/outlets/:id/toggle',
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

// ---------- Categories ----------
router.get('/categories', categoryAdminController.getCategories);
router.post('/categories', categoryAdminController.createCategory);
router.put('/categories/:id', categoryAdminController.updateCategory);
router.patch('/categories/:id/toggle', categoryAdminController.toggleCategory);
router.delete('/categories/:id', categoryAdminController.deleteCategory);

// ---------- Products (Menu Items) ----------

// List for admin panel
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

// Availability toggle
router.patch(
  '/products/:id/availability',
  productController.updateAvailability
);

// Soft delete
router.delete('/products/:id', productController.softDeleteProduct);

// Drag & drop reorder
router.post('/products/reorder', productController.reorderProducts);

// "Stop Today / Clear Today Block"
router.patch('/products/:id/stock-today', productController.toggleStockToday);

// per-product stats
router.get('/products/:id/stats', productController.getProductStats);


module.exports = router;