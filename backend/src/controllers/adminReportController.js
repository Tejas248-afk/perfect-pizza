// src/controllers/adminReportController.js
const mongoose = require('mongoose');
const Order = require('../models/Order');

// NOTE: apne Order model ke hisaab se ye cheezein adjust karo:
const ORDER_STATUS_FIELD = 'status';
const EXCLUDED_STATUSES = ['PENDING_PAYMENT', 'CANCELLED']; // jise count nahi karna
const CREATED_AT_FIELD = 'createdAt';

// Yahan se customer ko uniquely identify karoge
// e.g. '$customer.phone', '$phone', '$user', etc.
// => isko Order schema ke hisaab se UPDATE karna hoga
const CUSTOMER_KEY_EXPR = '$customer.phone'; // TODO: yahan apna field lagao

// Order total amount ka field – agar tumhare schema me 'grandTotal' / 'totalAmount' etc. hai
// ya to use karo; warna hum niche items.itemTotal se revenue nikal rahe hain
const ORDER_TOTAL_FIELD = '$grandTotal'; // optional, agar hai to use kar sakte ho

/* ========== Helpers ========== */

// IST datetime banane ke liye helper
function toIST(date) {
  return new Date(
    date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
}

// Range parsing (from/to) helpers
function parseDateRange(query) {
  const { from, to, range } = query;

  const now = new Date();
  const istNow = toIST(now);

  let start;
  let end;

  if (from && to) {
    start = new Date(from);
    end = new Date(to);
  } else if (range === 'today') {
    start = new Date(istNow);
    start.setHours(0, 0, 0, 0);
    end = new Date(istNow);
    end.setHours(23, 59, 59, 999);
  } else if (range === '7d') {
    end = istNow;
    start = new Date(istNow);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (range === '30d') {
    end = istNow;
    start = new Date(istNow);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'month') {
    // current month
    start = new Date(istNow.getFullYear(), istNow.getMonth(), 1);
    end = new Date(
      istNow.getFullYear(),
      istNow.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
  } else if (range === 'year') {
    // current year
    start = new Date(istNow.getFullYear(), 0, 1);
    end = new Date(
      istNow.getFullYear(),
      11,
      31,
      23,
      59,
      59,
      999
    );
  } else {
    // Default: last 30 days
    end = istNow;
    start = new Date(istNow);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

// Common match for completed orders in time range
function buildOrderMatch(start, end) {
  return {
    [CREATED_AT_FIELD]: { $gte: start, $lte: end },
    [ORDER_STATUS_FIELD]: { $nin: EXCLUDED_STATUSES },
  };
}

/* ========== 1. Sales Trend ========== */
/**
 * GET /api/admin/reports/sales-trend
 *
 * Query:
 *  - unit=day|week|month|year  (default: day)
 *  - range=today|7d|30d|month|year
 *  - from=ISO, to=ISO  (custom)
 *
 * Response:
 *  {
 *    points: [
 *      {
 *        label: "2026-10-05",
 *        date: "2026-10-05T00:00:00.000Z",
 *        orderCount: 12,
 *        itemsSold: 45,
 *        revenue: 12345
 *      },
 *      ...
 *    ],
 *    totalRevenue,
 *    totalOrders,
 *    totalItems
 *  }
 */
exports.getSalesTrend = async (req, res) => {
  try {
    const { unit = 'day' } = req.query;
    const { start, end } = parseDateRange(req.query);

    let format;
    if (unit === 'year') format = '%Y';
    else if (unit === 'month') format = '%Y-%m';
    else if (unit === 'week') format = '%G-W%V'; // ISO week
    else format = '%Y-%m-%d'; // day

    const matchStage = buildOrderMatch(start, end);

    const pipeline = [
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            bucket: {
              $dateToString: {
                date: `$${CREATED_AT_FIELD}`,
                format,
                timezone: 'Asia/Kolkata',
              },
            },
            rawDate: {
              $dateTrunc: {
                date: `$${CREATED_AT_FIELD}`,
                unit: unit === 'week' ? 'week' : unit,
                timezone: 'Asia/Kolkata',
              },
            },
          },
          revenue: { $sum: '$items.itemTotal' },
          itemsSold: { $sum: '$items.quantity' },
          orderIds: { $addToSet: '$_id' },
        },
      },
      {
        $project: {
          _id: 0,
          bucket: '$_id.bucket',
          date: '$_id.rawDate',
          revenue: 1,
          itemsSold: 1,
          orderCount: { $size: '$orderIds' },
        },
      },
      { $sort: { date: 1 } },
    ];

    const rows = await Order.aggregate(pipeline);

    const totalRevenue = rows.reduce(
      (sum, r) => sum + (r.revenue || 0),
      0
    );
    const totalOrders = rows.reduce(
      (sum, r) => sum + (r.orderCount || 0),
      0
    );
    const totalItems = rows.reduce(
      (sum, r) => sum + (r.itemsSold || 0),
      0
    );

    return res.json({
      range: { start, end },
      unit,
      points: rows,
      totalRevenue,
      totalOrders,
      totalItems,
    });
  } catch (err) {
    console.error('getSalesTrend error:', err);
    res
      .status(500)
      .json({ message: 'Failed to load sales trend.' });
  }
};

/* ========== 2. Peak Hour Report ========== */
/**
 * GET /api/admin/reports/peak-hours
 *
 * Query:
 *  - range=7d|30d|month|custom etc. (same as sales-trend)
 *  - from, to (optional)
 *
 * Response:
 *  {
 *    buckets: [
 *      { hour: 12, orderCount: 10, itemsSold: 35, revenue: 9000 },
 *      ...
 *    ]
 *  }
 */
exports.getPeakHours = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const matchStage = buildOrderMatch(start, end);

    const pipeline = [
      { $match: matchStage },
      {
        $addFields: {
          hourIST: {
            $hour: {
              date: `$${CREATED_AT_FIELD}`,
              timezone: 'Asia/Kolkata',
            },
          },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$hourIST',
          revenue: { $sum: '$items.itemTotal' },
          itemsSold: { $sum: '$items.quantity' },
          orderIds: { $addToSet: '$_id' },
        },
      },
      {
        $project: {
          _id: 0,
          hour: '$_id',
          revenue: 1,
          itemsSold: 1,
          orderCount: { $size: '$orderIds' },
        },
      },
      { $sort: { hour: 1 } },
    ];

    const rows = await Order.aggregate(pipeline);

    return res.json({
      range: { start, end },
      buckets: rows, // graph me 0-23 ke bars bana sakte ho
    });
  } catch (err) {
    console.error('getPeakHours error:', err);
    res
      .status(500)
      .json({ message: 'Failed to load peak hours.' });
  }
};

/* ========== 3. Customer Report ========== */
/**
 * GET /api/admin/reports/customers
 *
 * Query:
 *   - range / from / to (same helper)
 *
 * Output idea:
 * {
 *   totalCustomers,
 *   newCustomers,
 *   returningCustomers,
 *   repeatRate,              // returning / total
 *   avgOrderValue,
 *   avgOrdersPerCustomer,
 *   topCustomers: [
 *     { customerKey, orders, quantity, revenue },
 *     ...
 *   ]
 * }
 */
exports.getCustomerReport = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const matchStage = buildOrderMatch(start, end);

    const pipeline = [
      { $match: matchStage },
      {
        $addFields: {
          customerKey: CUSTOMER_KEY_EXPR,
        },
      },
      { $match: { customerKey: { $ne: null } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$customerKey',
          orderIds: { $addToSet: '$_id' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.itemTotal' },
        },
      },
      {
        $project: {
          _id: 0,
          customerKey: '$_id',
          orderCount: { $size: '$orderIds' },
          quantity: 1,
          revenue: 1,
        },
      },
      { $sort: { revenue: -1 } },
    ];

    const rows = await Order.aggregate(pipeline);

    const totalCustomers = rows.length;
    const newCustomers = rows.filter((r) => r.orderCount === 1)
      .length;
    const returningCustomers = totalCustomers - newCustomers;

    const totalOrders = rows.reduce(
      (sum, r) => sum + r.orderCount,
      0
    );
    const totalRevenue = rows.reduce(
      (sum, r) => sum + r.revenue,
      0
    );

    const repeatRate =
      totalCustomers > 0
        ? (returningCustomers / totalCustomers) * 100
        : 0;

    const avgOrderValue =
      totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const avgOrdersPerCustomer =
      totalCustomers > 0 ? totalOrders / totalCustomers : 0;

    const topCustomers = rows.slice(0, 10); // top 10

    return res.json({
      range: { start, end },
      totalCustomers,
      newCustomers,
      returningCustomers,
      repeatRate,
      avgOrderValue,
      avgOrdersPerCustomer,
      totalRevenue,
      totalOrders,
      topCustomers,
    });
  } catch (err) {
    console.error('getCustomerReport error:', err);
    res
      .status(500)
      .json({ message: 'Failed to load customer report.' });
  }
};

/* ========== 4. Customer Retention ========== */
/**
 * GET /api/admin/reports/customers/retention
 *
 * Query:
 *   - month=2026-09 (YYYY-MM)  (optional, default: current month IST)
 *   - windowDays=30            (retention window)
 *
 * Logic (simplified):
 *   - Base month ke all new customers (jin ka first order is month me hua)
 *   - Inme se:
 *       - ReturnedOnce: exactly 1 aur order window ke andar
 *       - Returned2Plus: 2+ orders window ke andar
 *
 * Response:
 *  {
 *    month: "2026-09",
 *    windowDays: 30,
 *    baseNewCustomers: 428,
 *    returnedOnce: 246,
 *    returned2Plus: 182,
 *    retentionRate: 42.5
 *  }
 */
exports.getCustomerRetention = async (req, res) => {
  try {
    const { month, windowDays = 30 } = req.query;

    const now = new Date();
    const istNow = toIST(now);

    let year, mon;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      year = y;
      mon = m - 1; // JS months 0-based
    } else {
      year = istNow.getFullYear();
      mon = istNow.getMonth();
    }

    const baseStart = new Date(year, mon, 1);
    const baseEnd = new Date(year, mon + 1, 0, 23, 59, 59, 999);

    const windowEnd = new Date(baseEnd);
    windowEnd.setDate(windowEnd.getDate() + Number(windowDays));

    const baseMatch = buildOrderMatch(baseStart, baseEnd);
    const windowMatch = buildOrderMatch(baseStart, windowEnd);

    // 1) Sare orders in window
    const allWindowOrders = await Order.aggregate([
      { $match: windowMatch },
      {
        $addFields: {
          customerKey: CUSTOMER_KEY_EXPR,
        },
      },
      { $match: { customerKey: { $ne: null } } },
      {
        $project: {
          _id: 1,
          customerKey: 1,
          createdAt: `$${CREATED_AT_FIELD}`,
        },
      },
    ]);

    const ordersByCustomer = new Map();
    for (const o of allWindowOrders) {
      const key = String(o.customerKey);
      if (!ordersByCustomer.has(key)) ordersByCustomer.set(key, []);
      ordersByCustomer.get(key).push(o);
    }

    // 2) Base month me pehli baar order karne wale customers
    const baseOrders = await Order.aggregate([
      { $match: baseMatch },
      {
        $addFields: {
          customerKey: CUSTOMER_KEY_EXPR,
        },
      },
      { $match: { customerKey: { $ne: null } } },
      {
        $group: {
          _id: '$customerKey',
          firstOrderAt: { $min: `$${CREATED_AT_FIELD}` },
        },
      },
      {
        $project: {
          _id: 0,
          customerKey: '$_id',
          firstOrderAt: 1,
        },
      },
    ]);

    const baseNewCustomers = baseOrders.length;

    let returnedOnce = 0;
    let returned2Plus = 0;

    for (const c of baseOrders) {
      const key = String(c.customerKey);
      const allOrders =
        ordersByCustomer.get(key) || [];

      // window me total orders
      const count = allOrders.length;

      if (count <= 1) continue; // sirf base order, no return
      if (count === 2) returnedOnce += 1;
      if (count >= 3) returned2Plus += 1;
    }

    const retained =
      returnedOnce + returned2Plus;
    const retentionRate =
      baseNewCustomers > 0
        ? (retained / baseNewCustomers) * 100
        : 0;

    return res.json({
      month: `${year}-${String(mon + 1).padStart(2, '0')}`,
      windowDays: Number(windowDays),
      baseNewCustomers,
      returnedOnce,
      returned2Plus,
      retentionRate,
    });
  } catch (err) {
    console.error('getCustomerRetention error:', err);
    res.status(500).json({
      message: 'Failed to load customer retention report.',
    });
  }
};