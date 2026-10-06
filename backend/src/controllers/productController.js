const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');

/* ========== Public: customer side ========== */

/**
 * Helper: current time (IST) ko fractional hours me (e.g. 10:30 => 10.5)
 */
function getCurrentHourIST() {
  const now = new Date();
  const istNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
  return istNow.getHours() + istNow.getMinutes() / 60;
}

/**
 * Helper: product ke availableFromHour / availableToHour ke basis par time check
 * supports:
 *  - dono null/undefined => hamesha available
 *  - sirf from set => from se aage
 *  - sirf to set => us time se pehle
 *  - wrap over midnight (e.g. 22.0 -> 3.0)
 */
function isWithinTimeWindow(item, currentHour) {
  const from =
    typeof item.availableFromHour === 'number'
      ? item.availableFromHour
      : null;
  const to =
    typeof item.availableToHour === 'number'
      ? item.availableToHour
      : null;

  if (from == null && to == null) return true;
  if (from != null && to == null) return currentHour >= from;
  if (from == null && to != null) return currentHour < to;

  if (from <= to) {
    // same-day window
    return currentHour >= from && currentHour < to;
  }
  // wrap-around (e.g. 22:00 -> 03:00 next day)
  return currentHour >= from || currentHour < to;
}

/**
 * GET /api/products
 * Customer ke liye products list
 */
exports.getProducts = async (req, res) => {
  try {
    // 1) Active categories (if any)
    const categories = await Category.find({ isActive: true })
      .sort({ order: 1, name: 1 })
      .lean();

    const activeCategoryNames = new Set(
      categories.map((c) => (c.name || '').trim()).filter(Boolean)
    );

    const categoryOrderMap = new Map();
    categories.forEach((c, idx) => {
      const key = (c.name || '').trim();
      if (!key) return;
      categoryOrderMap.set(key, idx);
    });

    // 2) Available products (sirf isAvailable=true)
    let products = await Product.find({
      isAvailable: true,
    }).lean();

    // 3) Time-based filter (IST) + dailyDisabledUntil
    const now = new Date();
    const hourIST = getCurrentHourIST();

    products = products.filter((p) => {
      // "Stop today" check
      if (p.dailyDisabledUntil && new Date(p.dailyDisabledUntil) > now) {
        return false;
      }

      // Time window check (supports custom HH:MM)
      if (!isWithinTimeWindow(p, hourIST)) {
        return false;
      }

      const cat = (p.category || '').trim();

      // Agar koi active category defined hai, to sirf unhi categories ke products dikhao
      if (activeCategoryNames.size > 0 && cat) {
        return activeCategoryNames.has(cat);
      }

      return true;
    });

    // 4) Add-ons filter: sirf isAvailable !== false waale add-ons bhejo
    products = products.map((p) => ({
      ...p,
      addOns: Array.isArray(p.addOns)
        ? p.addOns.filter((a) => a.isAvailable !== false)
        : [],
    }));

    // 5) Sort: category order -> displayOrder -> name
    products.sort((a, b) => {
      const ca = (a.category || '').trim();
      const cb = (b.category || '').trim();

      const oa = categoryOrderMap.has(ca)
        ? categoryOrderMap.get(ca)
        : Number.MAX_SAFE_INTEGER;
      const ob = categoryOrderMap.has(cb)
        ? categoryOrderMap.get(cb)
        : Number.MAX_SAFE_INTEGER;

      if (oa !== ob) return oa - ob;

      const da = typeof a.displayOrder === 'number' ? a.displayOrder : 0;
      const db = typeof b.displayOrder === 'number' ? b.displayOrder : 0;
      if (da !== db) return da - db;

      // same category, same displayOrder
      return (a.name || '').localeCompare(b.name || '');
    });

    return res.json({ products });
  } catch (err) {
    console.error('getProducts error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load products right now.' });
  }
};

/**
 * GET /api/products/:id
 * Customer ke liye single product detail
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product || product.isAvailable === false) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Optional: dailyDisabledUntil ko yahan bhi respect kar sakte ho
    const now = new Date();
    if (product.dailyDisabledUntil && product.dailyDisabledUntil > now) {
      return res
        .status(404)
        .json({ message: 'Product not available today' });
    }

    return res.json({ product });
  } catch (err) {
    console.error('getProductById error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load product details right now.' });
  }
};

/* ========== Admin: product management ========== */

/**
 * GET /api/admin/products
 * Admin panel ke liye saare products
 */
exports.getAllProductsAdmin = async (req, res) => {
  try {
    const products = await Product.find({}).sort({
      category: 1,
      displayOrder: 1,
      createdAt: -1,
    });

    return res.json({ products });
  } catch (err) {
    console.error('getAllProductsAdmin error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load products for admin right now.' });
  }
};

/**
 * POST /api/admin/products
 * Admin: naya product create karo
 * Supports: multipart/form-data (FormData) with:
 *   - field "data": JSON string of product body
 *   - field "image": image file (optional)
 * or pure JSON (old behaviour, without file)
 */
exports.createProduct = async (req, res) => {
  try {
    let body = {};

    // Agar FormData me "data" field aayi hai to usko JSON parse karo
    if (req.body && req.body.data) {
      try {
        body = JSON.parse(req.body.data);
      } catch (parseErr) {
        return res.status(400).json({
          message: 'Invalid product data JSON.',
          error: parseErr.message,
        });
      }
    } else {
      body = req.body || {};
    }

    // File aayi hai to absolute image URL set karo
    if (req.file) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      body.image = `${baseUrl}/uploads/${req.file.filename}`;
    }

    // Multipart se boolean string aa sakte hain
    if (typeof body.isVeg === 'string') {
      body.isVeg = body.isVeg === 'true';
    }
    if (typeof body.isAvailable === 'string') {
      body.isAvailable = body.isAvailable === 'true';
    }

    // Basic validation
    if (!body.name || !body.category) {
      return res
        .status(400)
        .json({ message: 'Name and category are required.' });
    }

    const product = await Product.create(body);

    return res.status(201).json({ product });
  } catch (err) {
    console.error('createProduct error:', err);
    return res
      .status(400)
      .json({ message: 'Unable to create product.', error: err.message });
  }
};

/**
 * PUT /api/admin/products/:id
 * Admin: existing product update karo
 * Supports:
 *   - multipart/form-data with optional:
 *       data: JSON string (partial/full update)
 *       image: new image file
 *   - or simple JSON body (old behaviour)
 *
 * NOTE:
 *   - body.comboConfig ko as-is DB me save kar diya jayega
 *   - Product schema me comboConfig field defined hai to ye persist ho jayega
 */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let body = {};

    if (req.body && req.body.data) {
      try {
        body = JSON.parse(req.body.data);
      } catch (parseErr) {
        return res.status(400).json({
          message: 'Invalid product data JSON.',
          error: parseErr.message,
        });
      }
    } else {
      body = req.body || {};
    }

    // File aayi hai to absolute image URL set karo
    if (req.file) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      body.image = `${baseUrl}/uploads/${req.file.filename}`;
    }

    if (typeof body.isVeg === 'string') {
      body.isVeg = body.isVeg === 'true';
    }
    if (typeof body.isAvailable === 'string') {
      body.isAvailable = body.isAvailable === 'true';
    }

    const product = await Product.findByIdAndUpdate(id, body, {
      new: true,
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json({ product });
  } catch (err) {
    console.error('updateProduct error:', err);
    return res
      .status(400)
      .json({ message: 'Unable to update product.', error: err.message });
  }
};

/**
 * PATCH /api/admin/products/:id/availability
 * Admin: product available / unavailable toggle
 */
exports.updateAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return res
        .status(400)
        .json({ message: 'isAvailable (boolean) is required.' });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.isAvailable = isAvailable;
    await product.save();

    return res.json({ product });
  } catch (err) {
    console.error('updateAvailability error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to update availability right now.' });
  }
};

/**
 * DELETE /api/admin/products/:id
 * Admin: soft delete → sirf available=false kar do
 */
exports.softDeleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    product.isAvailable = false;
    await product.save();

    return res.json({ message: 'Product deleted successfully', product });
  } catch (err) {
    console.error('softDeleteProduct error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to delete product right now.' });
  }
};

/* ========== NEW ADMIN FEATURES ========== */

/**
 * POST /api/admin/products/reorder
 * Body: { ids: [productId1, productId2, ...] }
 * Drag & drop ke baad naya displayOrder save karta hai.
 */
exports.reorderProducts = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: 'ids array is required.' });
    }

    const bulk = ids.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { displayOrder: index },
      },
    }));

    await Product.bulkWrite(bulk);

    return res.json({ message: 'Product order updated.' });
  } catch (err) {
    console.error('reorderProducts error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to reorder products right now.' });
  }
};

/**
 * PATCH /api/admin/products/:id/stock-today
 * "Stop Today / Clear Today Block" toggle.
 */
const endOfTodayIST = () => {
  const now = new Date();
  const istNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
  istNow.setHours(23, 59, 59, 999);
  return istNow;
};

exports.toggleStockToday = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const now = new Date();

    let newValue = null;
    if (product.dailyDisabledUntil && product.dailyDisabledUntil > now) {
      // Already blocked → clear
      newValue = null;
    } else {
      // Not blocked → block till end of today (IST)
      newValue = endOfTodayIST();
    }

    product.dailyDisabledUntil = newValue;
    await product.save();

    return res.json({
      message:
        newValue === null
          ? 'Today stock block cleared.'
          : 'Product disabled for today.',
      dailyDisabledUntil: product.dailyDisabledUntil,
    });
  } catch (err) {
    console.error('toggleStockToday error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to update today stock status.' });
  }
};

/**
 * GET /api/admin/products/:id/stats?days=7
 * Last N days ka mini stats (order count, qty, revenue, share%).
 */
exports.getProductStats = async (req, res) => {
  try {
    const { id } = req.params;
    const days = Number(req.query.days || 7);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: since },
          status: { $ne: 'PENDING_PAYMENT' },
        },
      },
      { $unwind: '$items' },
      {
        $match: {
          'items.product': new mongoose.Types.ObjectId(id),
        },
      },
      {
        $group: {
          _id: '$items.product',
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.itemTotal' },
          orderIds: { $addToSet: '$_id' },
        },
      },
    ];

    const [row] = await Order.aggregate(pipeline);

    if (!row) {
      return res.json({
        stats: {
          days,
          orderCount: 0,
          quantity: 0,
          revenue: 0,
          avgOrderValue: 0,
          orderSharePercent: 0,
        },
      });
    }

    const orderCount = row.orderIds.length;
    const quantity = row.quantity || 0;
    const revenue = row.revenue || 0;

    const totalOrders = await Order.countDocuments({
      createdAt: { $gte: since },
      status: { $ne: 'PENDING_PAYMENT' },
    });

    const avgOrderValue = orderCount ? revenue / orderCount : 0;
    const orderSharePercent =
      totalOrders > 0 ? (orderCount / totalOrders) * 100 : 0;

    return res.json({
      stats: {
        days,
        orderCount,
        quantity,
        revenue,
        avgOrderValue,
        orderSharePercent,
      },
    });
  } catch (err) {
    console.error('getProductStats error', err);
    return res
      .status(500)
      .json({ message: 'Unable to fetch product stats right now.' });
  }
};