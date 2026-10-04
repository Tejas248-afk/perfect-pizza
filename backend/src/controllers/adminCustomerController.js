// src/controllers/adminCustomerController.js
const Order = require('../models/Order');
const User = require('../models/User');

// Helper: segment decide karne ke liye
function getCustomerSegment(summary) {
  const {
    totalOrders,
    totalSpend,
    lastOrderAt,
    cancelledOrders,
  } = summary;

  const now = new Date();
  const last = lastOrderAt ? new Date(lastOrderAt) : null;
  const daysSinceLast =
    last ? (now - last) / (1000 * 60 * 60 * 24) : Infinity;

  const cancelRatio =
    totalOrders > 0 ? cancelledOrders / totalOrders : 0;

  if (totalOrders <= 1) return 'NEW';
  if (totalSpend > 5000) return 'HIGH_VALUE';
  if (daysSinceLast > 60) return 'INACTIVE';
  if (cancelRatio > 0.25 && totalOrders >= 4) return 'FREQUENTLY_CANCELLED';
  return 'REGULAR';
}

// GET /api/admin/customers
exports.getCustomersSummary = async (req, res, next) => {
  try {
    // Sab orders (admin view) – agar bohot zyada orders ho jaayen,
    // future me date filters add kar sakte hain
    const orders = await Order.find({
      status: { $ne: 'PENDING_PAYMENT' },
    })
      .sort({ createdAt: -1 })
      .populate('user', 'name contact');

    const map = new Map(); // key: userId, value: summary object

    for (const o of orders) {
      if (!o.user) continue;
      const userId = String(o.user._id);

      if (!map.has(userId)) {
        map.set(userId, {
          userId,
          name: o.user.name || 'Customer',
          contact: o.user.contact || '',
          totalOrders: 0,
          totalSpend: 0,
          lastOrderAt: null,
          cancelledOrders: 0,
          favItemCounts: {}, // { 'Margherita': 5, ... }
        });
      }

      const entry = map.get(userId);
      entry.totalOrders += 1;
      if (typeof o.grandTotal === 'number') {
        entry.totalSpend += o.grandTotal;
      }

      const candidateDate =
        o.deliveredAt || o.bakingAt || o.placedAt || o.createdAt;

      if (
        candidateDate &&
        (!entry.lastOrderAt || new Date(candidateDate) > new Date(entry.lastOrderAt))
      ) {
        entry.lastOrderAt = candidateDate;
      }

      if (String(o.status).toUpperCase() === 'CANCELLED') {
        entry.cancelledOrders += 1;
      }

      // Favourite item tracking
      (o.items || []).forEach((it) => {
        const key = it.name || 'Unknown';
        if (!entry.favItemCounts[key]) entry.favItemCounts[key] = 0;
        entry.favItemCounts[key] += it.quantity || 1;
      });
    }

    const summaries = Array.from(map.values()).map((entry) => {
      const favEntries = Object.entries(entry.favItemCounts || {});
      const fav =
        favEntries.length > 0
          ? favEntries.sort((a, b) => b[1] - a[1])[0][0]
          : null;

      const avgOrderValue =
        entry.totalOrders > 0
          ? Math.round(entry.totalSpend / entry.totalOrders)
          : 0;

      const segment = getCustomerSegment(entry);

      return {
        userId: entry.userId,
        name: entry.name,
        contact: entry.contact,
        totalOrders: entry.totalOrders,
        totalSpend: entry.totalSpend,
        avgOrderValue,
        lastOrderAt: entry.lastOrderAt,
        cancelledOrders: entry.cancelledOrders,
        favouriteItem: fav,
        segment,
      };
    });

    res.json(summaries);
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/customers/:id
exports.getCustomerProfile = async (req, res, next) => {
  try {
    const customerId = req.params.id;

    const userDoc = await User.findById(customerId).select(
      'name contact email rewardCoins createdAt'
    );

    if (!userDoc) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const orders = await Order.find({
      user: customerId,
      status: { $ne: 'PENDING_PAYMENT' },
    })
      .sort({ createdAt: -1 })
      .select(
        'outletName items subtotal deliveryFee taxAmount offerDiscount couponDiscount rewardDiscount grandTotal status payment createdAt placedAt deliveredAt cancelledAt delivery'
      );

    let totalOrders = orders.length;
    let totalSpend = 0;
    let cancelledOrders = 0;
    let lastOrderAt = null;
    const favItemCounts = {};
    const addressesSet = new Set();

    orders.forEach((o) => {
      if (typeof o.grandTotal === 'number') {
        totalSpend += o.grandTotal;
      }

      if (String(o.status).toUpperCase() === 'CANCELLED') {
        cancelledOrders += 1;
      }

      const candidateDate =
        o.deliveredAt || o.bakingAt || o.placedAt || o.createdAt;
      if (
        candidateDate &&
        (!lastOrderAt || new Date(candidateDate) > new Date(lastOrderAt))
      ) {
        lastOrderAt = candidateDate;
      }

      (o.items || []).forEach((it) => {
        const key = it.name || 'Unknown';
        if (!favItemCounts[key]) favItemCounts[key] = 0;
        favItemCounts[key] += it.quantity || 1;
      });

      const addr = o.delivery?.address;
      if (addr && addr.trim()) {
        addressesSet.add(addr.trim());
      }
    });

    const favEntries = Object.entries(favItemCounts || {});
    const favouriteItem =
      favEntries.length > 0
        ? favEntries.sort((a, b) => b[1] - a[1])[0][0]
        : null;

    const avgOrderValue =
      totalOrders > 0 ? Math.round(totalSpend / totalOrders) : 0;

    const summary = {
      userId: String(userDoc._id),
      name: userDoc.name,
      contact: userDoc.contact,
      email: userDoc.email,
      totalOrders,
      totalSpend,
      avgOrderValue,
      lastOrderAt,
      cancelledOrders,
      favouriteItem,
      rewardCoins: userDoc.rewardCoins || 0,
      addresses: Array.from(addressesSet),
    };

    const segment = getCustomerSegment(summary);

    res.json({
      profile: {
        ...summary,
        segment,
        createdAt: userDoc.createdAt,
      },
      orders,
    });
  } catch (err) {
    next(err);
  }
};