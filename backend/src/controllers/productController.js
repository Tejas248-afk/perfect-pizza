// src/controllers/productController.js
const Product = require('../models/Product');

/* ========== Public: customer side ========== */

/**
 * GET /api/products
 * Customer ke liye products list
 */
exports.getProducts = async (req, res) => {
  try {
    // Sirf available products dikhao
    const products = await Product.find({
      isAvailable: true
    }).sort({ category: 1, name: 1 });

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
    const products = await Product.find({}).sort({ createdAt: -1 });

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
          error: parseErr.message
        });
      }
    } else {
      body = req.body || {};
    }

    // File aayi hai to image path set karo
    if (req.file) {
      body.image = `/uploads/${req.file.filename}`;
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
          error: parseErr.message
        });
      }
    } else {
      body = req.body || {};
    }

    if (req.file) {
      body.image = `/uploads/${req.file.filename}`;
    }

    if (typeof body.isVeg === 'string') {
      body.isVeg = body.isVeg === 'true';
    }
    if (typeof body.isAvailable === 'string') {
      body.isAvailable = body.isAvailable === 'true';
    }

    const product = await Product.findByIdAndUpdate(id, body, {
      new: true
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