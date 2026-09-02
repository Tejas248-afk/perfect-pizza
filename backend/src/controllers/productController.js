const Joi = require('joi');
const Product = require('../models/Product');

// ---------- Validation Schemas ----------

const SIZE_VALUES = ['REGULAR', 'MEDIUM', 'LARGE'];

const sizeSchema = Joi.object({
  name: Joi.string()
    .valid(...SIZE_VALUES)
    .required(),
  price: Joi.number().min(0).required(),
  isAvailable: Joi.boolean().default(true)
});

const crustPriceSchema = Joi.object({
  size: Joi.string()
    .valid(...SIZE_VALUES)
    .required(),
  price: Joi.number().min(0).required()
});

const crustSchema = Joi.object({
  name: Joi.string().required(),
  isAvailable: Joi.boolean().default(true),
  prices: Joi.array().items(crustPriceSchema).default([])
});

const addOnPriceSchema = Joi.object({
  size: Joi.string()
    .valid(...SIZE_VALUES)
    .required(),
  price: Joi.number().min(0).required()
});

const addOnSchema = Joi.object({
  name: Joi.string().required(),
  isRequired: Joi.boolean().default(false),
  multiple: Joi.boolean().default(true),
  isAvailable: Joi.boolean().default(true),
  prices: Joi.array().items(addOnPriceSchema).default([])
});

const productCreateSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  category: Joi.string().min(2).max(100).required(),
  description: Joi.string().allow('', null),
    // image URL ya relative path – admin manual control
  image: Joi.string().allow('', null),
  isVeg: Joi.boolean().default(true),
  isAvailable: Joi.boolean().default(true),
  sizes: Joi.array().items(sizeSchema).min(1).required(),
  crusts: Joi.array().items(crustSchema).default([]),
  addOns: Joi.array().items(addOnSchema).default([])
});

const productUpdateSchema = productCreateSchema.fork(
  [
    'name',
    'category',
    'sizes' // update me optional hone denge
  ],
  field => field.optional()
);

// ---------- Controllers ----------

// GET /api/products
exports.getProducts = async (req, res) => {
  try {
    const { category, search, isVeg } = req.query;

    const filter = { isAvailable: true };

    if (category) {
      filter.category = category;
    }

    if (typeof isVeg !== 'undefined') {
      if (isVeg === 'true' || isVeg === '1') filter.isVeg = true;
      if (isVeg === 'false' || isVeg === '0') filter.isVeg = false;
    }

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const products = await Product.find(filter).sort({ category: 1, name: 1 });

    return res.json({ products });
  } catch (err) {
    console.error('getProducts error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to fetch products right now.' });
  }
};

// GET /api/products/:id
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      _id: id,
      isAvailable: true
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json({ product });
  } catch (err) {
    console.error('getProductById error:', err);
    return res.status(500).json({ message: 'Error fetching product' });
  }
};

// POST /api/products   (ADMIN only)
exports.createProduct = async (req, res) => {
  try {
    const { error, value } = productCreateSchema.validate(req.body || {}, {
      abortEarly: false
    });

    if (error) {
      return res
        .status(400)
        .json({ message: error.details[0].message, details: error.details });
    }

    const product = await Product.create(value);
    return res.status(201).json({ message: 'Product created', product });
  } catch (err) {
    console.error('createProduct error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to create product right now.' });
  }
};

// PUT /api/products/:id  (ADMIN only)
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const { error, value } = productUpdateSchema.validate(req.body || {}, {
      abortEarly: false
    });

    if (error) {
      return res
        .status(400)
        .json({ message: error.details[0].message, details: error.details });
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: value },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json({ message: 'Product updated', product });
  } catch (err) {
    console.error('updateProduct error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to update product right now.' });
  }
};

// PATCH /api/products/:id/availability  (ADMIN only)
exports.updateAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: { isAvailable: !!isAvailable } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json({
      message: 'Availability updated',
      product: { id: product._id, isAvailable: product.isAvailable }
    });
  } catch (err) {
    console.error('updateAvailability error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to update availability right now.' });
  }
};
// Admin: list all products (including unavailable)
exports.getAllProductsAdmin = async (req, res) => {
  try {
    const products = await Product.find().sort({ category: 1, name: 1 });
    return res.json({ products });
  } catch (err) {
    console.error('getAllProductsAdmin error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to fetch products right now.' });
  }
};

// Admin: soft delete (mark unavailable)
exports.softDeleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(
      id,
      { $set: { isAvailable: false } },
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.json({ message: 'Product disabled', product });
  } catch (err) {
    console.error('softDeleteProduct error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to delete product right now.' });
  }
};