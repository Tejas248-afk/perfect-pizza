// src/controllers/adminController.js
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const DeliveryRule = require('../models/DeliveryRule');

// GET /api/admin/overview?outletId=
exports.getOverview = async (req, res) => {
  try {
    const { outletId } = req.query;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const matchToday = {
      createdAt: { $gte: startOfDay }
    };
    if (outletId) {
      matchToday.outlet = outletId;
    }

    const todayAgg = await Order.aggregate([
      { $match: matchToday },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] }
          },
          pendingOrders: {
            $sum: {
              $cond: [
                {
                  $in: ['$status', ['PLACED', 'BAKING', 'OUT_FOR_DELIVERY']]
                },
                1,
                0
              ]
            }
          },
          sales: {
            $sum: {
              $cond: [
                { $ne: ['$status', 'CANCELLED'] },
                '$grandTotal',
                0
              ]
            }
          }
        }
      }
    ]);

    const today =
      todayAgg && todayAgg.length
        ? {
            totalOrders: todayAgg[0].totalOrders,
            deliveredOrders: todayAgg[0].deliveredOrders,
            pendingOrders: todayAgg[0].pendingOrders,
            sales: todayAgg[0].sales
          }
        : { totalOrders: 0, deliveredOrders: 0, pendingOrders: 0, sales: 0 };

    const totalCustomers = await User.countDocuments({
      role: User.ROLES.CUSTOMER
    });

    return res.json({ today, totalCustomers });
  } catch (err) {
    console.error('Admin getOverview error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load admin overview right now.' });
  }
};

// GET /api/admin/orders?status=&search=&page=&limit=&outletId=&onlyToday=
exports.getOrders = async (req, res) => {
  try {
    const {
      status,
      search,
      page = 1,
      limit = 20,
      outletId,
      onlyToday
    } = req.query;
    const query = {};

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (outletId) {
      query.outlet = outletId;
    }

    if (onlyToday === 'true') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      query.createdAt = { $gte: startOfDay };
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { 'payment.paymentReference': regex },
        { _id: search.length >= 12 ? search : undefined } // rough
      ].filter(Boolean);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('user', 'name contact'),
      Order.countDocuments(query)
    ]);

    return res.json({
      total,
      page: pageNum,
      limit: limitNum,
      orders
    });
  } catch (err) {
    console.error('Admin getOrders error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to fetch orders for admin right now.' });
  }
};

// GET /api/admin/customers
exports.getCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: User.ROLES.CUSTOMER }).select(
      'name contact rewardCoins createdAt'
    );

    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$user',
          totalOrders: { $sum: 1 },
          totalSpend: {
            $sum: {
              $cond: [
                { $ne: ['$status', 'CANCELLED'] },
                '$grandTotal',
                0
              ]
            }
          }
        }
      }
    ]);

    const statsMap = new Map(stats.map(s => [String(s._id), s]));

    const result = customers.map(c => {
      const s = statsMap.get(String(c._id)) || {
        totalOrders: 0,
        totalSpend: 0
      };
      return {
        id: c._id,
        name: c.name,
        contact: c.contact,
        rewardCoins: c.rewardCoins,
        createdAt: c.createdAt,
        totalOrders: s.totalOrders,
        totalSpend: s.totalSpend
      };
    });

    return res.json({ customers: result });
  } catch (err) {
    console.error('Admin getCustomers error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to fetch customers right now.' });
  }
};

// ---------- Delivery Rules ----------

// GET /api/admin/delivery-rules
exports.getDeliveryRules = async (req, res) => {
  try {
    const rules = await DeliveryRule.find().sort({ minDistance: 1 });
    return res.json({ rules });
  } catch (err) {
    console.error('Admin getDeliveryRules error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load delivery rules right now.' });
  }
};

// POST /api/admin/delivery-rules
exports.createDeliveryRule = async (req, res) => {
  try {
    const rule = await DeliveryRule.create(req.body);
    return res.status(201).json({ rule });
  } catch (err) {
    console.error('Admin createDeliveryRule error:', err);
    return res
      .status(400)
      .json({ message: 'Invalid delivery rule data.', error: err.message });
  }
};

// PUT /api/admin/delivery-rules/:id
exports.updateDeliveryRule = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await DeliveryRule.findByIdAndUpdate(id, req.body, {
      new: true
    });
    if (!rule) {
      return res.status(404).json({ message: 'Delivery rule not found' });
    }
    return res.json({ rule });
  } catch (err) {
    console.error('Admin updateDeliveryRule error:', err);
    return res
      .status(400)
      .json({ message: 'Unable to update delivery rule.', error: err.message });
  }
};

// PATCH /api/admin/delivery-rules/:id/toggle
exports.toggleDeliveryRule = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await DeliveryRule.findById(id);
    if (!rule) {
      return res.status(404).json({ message: 'Delivery rule not found' });
    }
    rule.isActive = !rule.isActive;
    await rule.save();
    return res.json({ rule });
  } catch (err) {
    console.error('Admin toggleDeliveryRule error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to toggle delivery rule right now.' });
  }
};

// ========== ANALYTICS HELPERS ==========

function getDateRangeFromQuery(query) {
  const { from, to } = query;

  let fromDate = from ? new Date(from) : null;
  let toDate = to ? new Date(to) : null;

  // Default: last 7 days (including today)
  if (!fromDate || Number.isNaN(fromDate.getTime())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    toDate = toDate && !Number.isNaN(toDate.getTime()) ? toDate : new Date(today);
    fromDate = new Date(toDate);
    fromDate.setDate(fromDate.getDate() - 6);
  }

  if (!toDate || Number.isNaN(toDate.getTime())) {
    toDate = new Date();
  }

  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(0, 0, 0, 0);

  if (fromDate > toDate) {
    const tmp = fromDate;
    fromDate = toDate;
    toDate = tmp;
  }

  const toExclusive = new Date(toDate);
  toExclusive.setDate(toExclusive.getDate() + 1);

  return { fromDate, toDate, toExclusive };
}

// ========== ANALYTICS CONTROLLERS ==========

// GET /api/admin/analytics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&outletId=
exports.getAnalyticsSummary = async (req, res) => {
  try {
    const { fromDate, toExclusive } = getDateRangeFromQuery(req.query);
    const { outletId } = req.query;

    const matchBase = {
      createdAt: { $gte: fromDate, $lt: toExclusive },
      status: { $ne: 'PENDING_PAYMENT' }
    };

    if (outletId && mongoose.Types.ObjectId.isValid(outletId)) {
      matchBase.outlet = new mongoose.Types.ObjectId(outletId);
    }

    // Total orders + total sales
    const [summaryRow] = await Order.aggregate([
      { $match: matchBase },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSales: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'CANCELLED'] },
                0,
                '$grandTotal'
              ]
            }
          }
        }
      }
    ]);

    const totalOrders = summaryRow ? summaryRow.totalOrders : 0;
    const totalSales = summaryRow ? summaryRow.totalSales : 0;
    const avgOrderValue = totalOrders ? totalSales / totalOrders : 0;

    // Payment breakdown
    const paymentAgg = await Order.aggregate([
      { $match: matchBase },
      {
        $group: {
          _id: '$payment.paymentType',
          count: { $sum: 1 },
          amount: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'CANCELLED'] },
                0,
                '$grandTotal'
              ]
            }
          }
        }
      }
    ]);

    const paymentBreakdown = (paymentAgg || []).map(row => ({
      type: row._id || 'UNKNOWN',
      count: row.count || 0,
      amount: row.amount || 0
    }));

    // Status breakdown
    const statusAgg = await Order.aggregate([
      { $match: matchBase },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusBreakdown = {};
    (statusAgg || []).forEach(row => {
      statusBreakdown[row._id] = row.count;
    });

    // New vs Returning customers
    const customersInRange = await Order.distinct('user', matchBase);

    let newCustomers = 0;
    let returningCustomers = 0;

    if (customersInRange.length) {
      const firstOrders = await Order.aggregate([
        {
          $match: {
            user: { $in: customersInRange },
            status: { $ne: 'PENDING_PAYMENT' }
          }
        },
        {
          $group: {
            _id: '$user',
            firstOrder: { $min: '$createdAt' }
          }
        }
      ]);

      firstOrders.forEach(row => {
        if (row.firstOrder >= fromDate) newCustomers += 1;
        else returningCustomers += 1;
      });
    }

    return res.json({
      range: {
        from: fromDate,
        to: new Date(toExclusive.getTime() - 1)
      },
      totalOrders,
      totalSales,
      avgOrderValue,
      newCustomers,
      returningCustomers,
      paymentBreakdown,
      statusBreakdown
    });
  } catch (err) {
    console.error('Admin getAnalyticsSummary error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load analytics summary right now.' });
  }
};

// GET /api/admin/analytics/top-products?from=&to=&outletId=&limit=&sortBy=
exports.getAnalyticsTopProducts = async (req, res) => {
  try {
    const { fromDate, toExclusive } = getDateRangeFromQuery(req.query);
    const { outletId } = req.query;

    const match = {
      createdAt: { $gte: fromDate, $lt: toExclusive },
      status: { $nin: ['PENDING_PAYMENT', 'CANCELLED'] }
    };

    if (outletId && mongoose.Types.ObjectId.isValid(outletId)) {
      match.outlet = new mongoose.Types.ObjectId(outletId);
    }

    const limit = Math.max(
      1,
      Math.min(50, parseInt(req.query.limit, 10) || 10)
    );
    const sortBy = req.query.sortBy === 'revenue' ? 'revenue' : 'quantity';

    const rows = await Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.productName' },
          category: { $first: '$items.category' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.itemTotal' }
        }
      },
      { $sort: { [sortBy]: -1 } },
      { $limit: limit }
    ]);

    const topProducts = (rows || []).map(r => ({
      productId: r._id,
      name: r.name || '',
      category: r.category || '',
      quantity: r.quantity || 0,
      revenue: r.revenue || 0
    }));

    return res.json({ topProducts });
  } catch (err) {
    console.error('Admin getAnalyticsTopProducts error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load top products right now.' });
  }
};

// GET /api/admin/analytics/top-customers?from=&to=&outletId=&limit=
exports.getAnalyticsTopCustomers = async (req, res) => {
  try {
    const { fromDate, toExclusive } = getDateRangeFromQuery(req.query);
    const { outletId } = req.query;

    const match = {
      createdAt: { $gte: fromDate, $lt: toExclusive },
      status: { $ne: 'PENDING_PAYMENT' }
    };

    if (outletId && mongoose.Types.ObjectId.isValid(outletId)) {
      match.outlet = new mongoose.Types.ObjectId(outletId);
    }

    const limit = Math.max(
      1,
      Math.min(50, parseInt(req.query.limit, 10) || 10)
    );

    const rows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$user',
          orderCount: { $sum: 1 },
          totalSpend: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'CANCELLED'] },
                0,
                '$grandTotal'
              ]
            }
          }
        }
      },
      { $sort: { totalSpend: -1 } },
      { $limit: limit }
    ]);

    const userIds = (rows || []).map(r => r._id).filter(Boolean);

    const users = await User.find({ _id: { $in: userIds } })
      .select('name contact')
      .lean();

    const userMap = new Map(users.map(u => [String(u._id), u]));

    const topCustomers = (rows || []).map(r => {
      const u = userMap.get(String(r._id));
      return {
        userId: r._id,
        name: u ? u.name : 'Unknown',
        contact: u ? u.contact : '',
        orderCount: r.orderCount || 0,
        totalSpend: r.totalSpend || 0
      };
    });

    return res.json({ topCustomers });
  } catch (err) {
    console.error('Admin getAnalyticsTopCustomers error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load top customers right now.' });
  }
};

// GET /api/admin/analytics/orders-by-hour?from=&to=&outletId=
exports.getAnalyticsOrdersByHour = async (req, res) => {
  try {
    const { fromDate, toExclusive } = getDateRangeFromQuery(req.query);
    const { outletId } = req.query;

    const match = {
      createdAt: { $gte: fromDate, $lt: toExclusive },
      status: { $ne: 'PENDING_PAYMENT' }
    };

    if (outletId && mongoose.Types.ObjectId.isValid(outletId)) {
      match.outlet = new mongoose.Types.ObjectId(outletId);
    }

    const rows = await Order.aggregate([
      { $match: match },
      {
        $project: {
          grandTotal: 1,
          status: 1,
          hour: {
            $toInt: {
              $dateToString: {
                format: '%H',
                date: '$createdAt',
                timezone: 'Asia/Kolkata'
              }
            }
          }
        }
      },
      {
        $group: {
          _id: '$hour',
          orderCount: { $sum: 1 },
          totalSales: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'CANCELLED'] },
                0,
                '$grandTotal'
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const byHourMap = new Map();
    (rows || []).forEach(r => {
      byHourMap.set(r._id, {
        orderCount: r.orderCount || 0,
        totalSales: r.totalSales || 0
      });
    });

    const byHour = [];
    for (let h = 0; h < 24; h += 1) {
      const row = byHourMap.get(h) || { orderCount: 0, totalSales: 0 };
      byHour.push({
        hour: h,
        orderCount: row.orderCount,
        totalSales: row.totalSales
      });
    }

    return res.json({ byHour });
  } catch (err) {
    console.error('Admin getAnalyticsOrdersByHour error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to load hourly analytics right now.' });
  }
};