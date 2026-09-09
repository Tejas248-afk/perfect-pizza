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

// Delivery Rules

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