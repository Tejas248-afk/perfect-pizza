// src/controllers/adminUserController.js
const User = require('../models/User');
const Order = require('../models/Order');

const ALLOWED_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'KITCHEN',
  'CASHIER',
  'CUSTOMER',
];

exports.listUsers = async (req, res, next) => {
  try {
    // Basic user info
    const users = await User.find()
      .select('name contact email role rewardCoins createdAt lastLoginAt lastOrderAt')
      .sort({ createdAt: -1 });

    // Optional: quick order counts per user
    const ordersAgg = await Order.aggregate([
      {
        $group: {
          _id: '$user',
          totalOrders: { $sum: 1 },
          totalSpend: { $sum: '$grandTotal' },
        },
      },
    ]);

    const map = new Map();
    ordersAgg.forEach((o) => {
      map.set(String(o._id), {
        totalOrders: o.totalOrders || 0,
        totalSpend: o.totalSpend || 0,
      });
    });

    const result = users.map((u) => {
      const extra = map.get(String(u._id)) || {
        totalOrders: 0,
        totalSpend: 0,
      };
      return {
        id: String(u._id),
        name: u.name || 'User',
        contact: u.contact || '',
        email: u.email || '',
        role: u.role || 'CUSTOMER',
        rewardCoins: u.rewardCoins || 0,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        lastOrderAt: u.lastOrderAt,
        totalOrders: extra.totalOrders,
        totalSpend: extra.totalSpend,
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const targetId = req.params.id;

    if (!role) {
      return res.status(400).json({ message: 'Role is required' });
    }

    const upperRole = String(role).toUpperCase();
    if (!ALLOWED_ROLES.includes(upperRole)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const requester = req.user;

    // Only SUPER_ADMIN can manage SUPER_ADMIN role
    if (upperRole === 'SUPER_ADMIN' && requester.role !== 'SUPER_ADMIN') {
      return res
        .status(403)
        .json({ message: 'Only SUPER_ADMIN can assign SUPER_ADMIN role' });
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (
      String(targetUser._id) !== String(requester._id) &&
      targetUser.role === 'SUPER_ADMIN' &&
      requester.role !== 'SUPER_ADMIN'
    ) {
      return res
        .status(403)
        .json({ message: 'You cannot modify SUPER_ADMIN user' });
    }

    targetUser.role = upperRole;
    await targetUser.save();

    res.json({
      message: 'Role updated',
      user: {
        id: String(targetUser._id),
        role: targetUser.role,
      },
    });
  } catch (err) {
    next(err);
  }
};