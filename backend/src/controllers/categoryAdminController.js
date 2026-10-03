// src/controllers/categoryAdminController.js
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');

// GET /api/admin/categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({})
      .sort({ order: 1, name: 1 })
      .lean();
    return res.json({ categories });
  } catch (err) {
    console.error('Admin getCategories error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load categories right now.' });
  }
};

// POST /api/admin/categories
exports.createCategory = async (req, res) => {
  try {
    const { name, label, icon, order } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Name is required.' });
    }

    const cat = await Category.create({
      name: String(name).trim(),
      label: (label || '').trim(),
      icon: (icon || '').trim(),
      order:
        typeof order === 'number' && !Number.isNaN(order)
          ? order
          : 0
    });

    return res.status(201).json({ category: cat });
  } catch (err) {
    console.error('Admin createCategory error:', err);
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ message: 'Category name must be unique.' });
    }
    return res
      .status(500)
      .json({ message: 'Unable to create category right now.' });
  }
};

// PUT /api/admin/categories/:id
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid category id' });
    }

    const cat = await Category.findById(id);
    if (!cat) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const oldName = cat.name;

    const { name, label, icon, order, description } = req.body || {};

    if (name && String(name).trim() !== '') {
      cat.name = String(name).trim();
    }
    if (typeof label === 'string') {
      cat.label = label.trim();
    }
    if (typeof icon === 'string') {
      cat.icon = icon.trim();
    }
    if (typeof description === 'string') {
      cat.description = description.trim();
    }
    if (typeof order === 'number' && !Number.isNaN(order)) {
      cat.order = order;
    }

    await cat.save();

    // Agar name change hua hai to Product.category ko update karo
    if (oldName !== cat.name) {
      await Product.updateMany(
        { category: oldName },
        { $set: { category: cat.name } }
      );
    }

    return res.json({ category: cat });
  } catch (err) {
    console.error('Admin updateCategory error:', err);
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ message: 'Category name must be unique.' });
    }
    return res
      .status(500)
      .json({ message: 'Unable to update category right now.' });
  }
};

// PATCH /api/admin/categories/:id/toggle
exports.toggleCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const cat = await Category.findById(id);
    if (!cat) {
      return res.status(404).json({ message: 'Category not found' });
    }

    cat.isActive = !cat.isActive;
    await cat.save();

    return res.json({ category: cat });
  } catch (err) {
    console.error('Admin toggleCategory error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to toggle category right now.' });
  }
};

// DELETE /api/admin/categories/:id
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const cat = await Category.findById(id);
    if (!cat) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const count = await Product.countDocuments({ category: cat.name });
    if (count > 0) {
      return res.status(400).json({
        message:
          'Cannot delete category because some products are using it. Please move or update those products first.'
      });
    }

    await cat.deleteOne();

    return res.json({ message: 'Category deleted.' });
  } catch (err) {
    console.error('Admin deleteCategory error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to delete category right now.' });
  }
};