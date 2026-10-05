// src/controllers/orderController.js
const Joi = require('joi');
const Order = require('../models/Order');
const Outlet = require('../models/Outlet');
const { buildOrderPreview } = require('../services/orderService');
const { logActivity } = require('../services/activityService');
const {
  emitNewOrder,
  emitOrderStatusUpdated
} = require('../sockets/socket');

// ---------- CART ITEM VALIDATION ----------

const cartItemSchema = Joi.object({
  productId: Joi.string().required(),
  size: Joi.string().required(),
  crust: Joi.string().required(),
  quantity: Joi.number().integer().min(1).max(20).required(),

  addOns: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        quantity: Joi.number().integer().min(1).max(5).default(1)
      })
    )
    .default([]),

  comboSelections: Joi.array()
    .items(
      Joi.object({
        groupKey: Joi.string().allow('', null),
        groupTitle: Joi.string().allow('', null),
        label: Joi.string().required(),
        extraPrice: Joi.number().min(0).default(0)
      })
    )
    .default([])
});

const orderBaseSchema = Joi.object({
  outletId: Joi.string().allow('', null),
  items: Joi.array().items(cartItemSchema).min(1).required(),
  deliveryType: Joi.string().valid('DELIVERY', 'PICKUP').required(),
  address: Joi.string().allow('', null),
  landmark: Joi.string().allow('', null),
  latitude: Joi.number().allow(null),
  longitude: Joi.number().allow(null),
  rewardCoinsToUse: Joi.number().integer().min(0).default(0),
  couponCode: Joi.string().allow('', null)
});

const DEFAULT_OUTLET_ID = process.env.DEFAULT_OUTLET_ID;

/* ---------- Helpers ---------- */

async function resolveOutlet(requestOutletId) {
  const outletId = requestOutletId || DEFAULT_OUTLET_ID;
  if (!outletId) {
    const err = new Error('Outlet is not configured.');
    err.statusCode = 500;
    throw err;
  }

  const outlet = await Outlet.findById(outletId);
  if (!outlet || !outlet.isActive) {
    const err = new Error('The selected outlet is not available.');
    err.statusCode = 400;
    throw err;
  }
  return outlet;
}

function ensureStoreOpen(outlet) {
  // India time (IST)
  const now = new Date();
  const istNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
  const hour = istNow.getHours();

  // Outlet specific hours (fallback 10–23 if not set)
  const open = typeof outlet.openHour === 'number' ? outlet.openHour : 10;
  const close = typeof outlet.closeHour === 'number' ? outlet.closeHour : 23;

  if (hour < open || hour >= close) {
    const err = new Error(
      `Store "${outlet.name}" is currently closed. Orders are allowed from ${open}:00 to ${close}:00.`
    );
    err.statusCode = 400;
    throw err;
  }
}

/* ---------- Controllers ---------- */

// POST /api/orders/preview
// POST /api/orders/preview
exports.previewOrder = async (req, res) => {
  try {
    const { error, value } = orderBaseSchema.validate(req.body || {}, {
      abortEarly: false
    });

    if (error) {
      return res
        .status(400)
        .json({ message: error.details[0].message, details: error.details });
    }

    const outlet = await resolveOutlet(value.outletId);
    ensureStoreOpen(outlet);

    const preview = await buildOrderPreview({
      user: req.user,
      outlet,
      ...value
    });

    return res.json({ preview });
  } catch (err) {
    console.error('previewOrder error:', err);

    const status = err.statusCode || err.status || 500;
    const hasCoupon = req.body && req.body.couponCode;

    // Agar coupon ki wajah se 4xx error aayi ho, to bina coupon ke retry karo
    if (
      hasCoupon &&
      status >= 400 &&
      status < 500 &&
      (err.code === 'COUPON_INVALID' ||
        /coupon/i.test(err.message || ''))
    ) {
      console.warn(
        'Retrying preview without coupon due to coupon error:',
        err.message || err
      );

      try {
        const bodyNoCoupon = {
          ...(req.body || {}),
          couponCode: ''
        };

        const { error: vErr, value: value2 } = orderBaseSchema.validate(
          bodyNoCoupon,
          { abortEarly: false }
        );

        if (vErr) {
          return res.status(400).json({
            message: vErr.details[0].message,
            details: vErr.details
          });
        }

        const outlet2 = await resolveOutlet(value2.outletId);
        ensureStoreOpen(outlet2);

        const preview2 = await buildOrderPreview({
          user: req.user,
          outlet: outlet2,
          ...value2
        });

        // couponRemoved: true optional flag, agar frontend use karna chahe
        return res.json({ preview: preview2, couponRemoved: true });
      } catch (err2) {
        console.error('previewOrder retry without coupon error:', err2);
        const status2 = err2.statusCode || err2.status || 500;
        return res.status(status2).json({
          message:
            err2.statusCode && status2 < 500
              ? err2.message
              : 'Unable to calculate order total right now.'
        });
      }
    }

    const finalStatus = status || 500;
    return res.status(finalStatus).json({
      message:
        err.statusCode && finalStatus < 500
          ? err.message
          : 'Unable to calculate order total right now.'
    });
  }
};

// POST /api/orders/cod
exports.createCodOrder = async (req, res) => {
  try {
    const { error, value } = orderBaseSchema.validate(req.body || {}, {
      abortEarly: false
    });

    if (error) {
      return res
        .status(400)
        .json({ message: error.details[0].message, details: error.details });
    }

    const outlet = await resolveOutlet(value.outletId);
    ensureStoreOpen(outlet);

    const preview = await buildOrderPreview({
      user: req.user,
      outlet,
      ...value
    });

    const order = await Order.create({
      user: preview.userId,
      outlet: outlet._id,
      outletName: outlet.name,
      items: preview.items,
      delivery: preview.delivery,
      subtotal: preview.subtotal,
      offerDiscount: preview.offerDiscount,
      deliveryFee: preview.deliveryFee,
      taxAmount: preview.taxAmount,
      couponCode: preview.couponCode || '',
      couponDiscount: preview.couponDiscount || 0,
      rewardCoinsUsed: preview.rewardCoinsUsed,
      rewardDiscount: preview.rewardDiscount,
      grandTotal: preview.grandTotal,
      rewardCoinsEarned: preview.rewardCoinsEarned,

      placedAt: new Date(),

      payment: {
        paymentType: 'COD',
        paymentStatus: 'PENDING',
        paymentReference: `COD-${Date.now()}`
      },
      status: 'PLACED'
    });

    // Reward coins balance update: current - used + earned
    try {
      const currentCoins = Number(req.user.rewardCoins || 0);
      const used = Number(preview.rewardCoinsUsed || 0);
      const earned = Number(preview.rewardCoinsEarned || 0);

      let newBalance = currentCoins - used + earned;
      if (newBalance < 0) newBalance = 0;

      req.user.rewardCoins = newBalance;
      await req.user.save();
    } catch (uErr) {
      console.error('Failed to update reward coins for user:', uErr);
    }

    emitNewOrder(order);

    return res.status(201).json({
      message: 'Order placed successfully',
      orderId: order._id,
      order
    });
  } catch (err) {
    console.error('createCodOrder error:', err);

    const status = err.statusCode || 500;

    return res.status(status).json({
      message:
        err.statusCode && status < 500
          ? err.message
          : 'Unable to place order right now.'
    });
  }
};

// GET /api/orders/my
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user._id,
      status: { $ne: 'PENDING_PAYMENT' }
    })
      .sort({ createdAt: -1 })
      .select(
        'outletName subtotal deliveryFee taxAmount offerDiscount couponDiscount rewardDiscount grandTotal status payment createdAt placedAt bakingAt outForDeliveryAt deliveredAt cancelledAt'
      );

    return res.json({ orders });
  } catch (err) {
    console.error('getMyOrders error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to fetch your orders right now.' });
  }
};

// GET /api/orders/:id
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id).populate('user', 'name contact');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const isCustomer = req.user.role === 'CUSTOMER';

    if (isCustomer && String(order.user._id) !== String(req.user._id)) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.json({ order });
  } catch (err) {
    console.error('getOrderById error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to fetch order details right now.' });
  }
};

// GET /api/orders/kitchen
exports.getKitchenOrders = async (req, res) => {
  try {
    const { filter } = req.query;

    let query = {};

    // DEFAULT: active
    if (filter === 'active' || !filter) {
      query.status = { $in: ['PLACED', 'BAKING', 'OUT_FOR_DELIVERY'] };
    } else if (filter === 'completed') {
      query.status = 'DELIVERED';
    } else if (filter === 'new') {
      query.status = 'PLACED';
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'name contact');

    return res.json({ orders });
  } catch (err) {
    console.error('getKitchenOrders error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to fetch kitchen orders right now.' });
  }
};

// PATCH /api/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'New status is required' });
    }

    const allowedStatuses = Order.STATUS;
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const currentStatus = order.status;
    const deliveryType = order.delivery?.deliveryType || 'DELIVERY';

    const transitionsDelivery = {
      PLACED: ['BAKING', 'OUT_FOR_DELIVERY', 'CANCELLED'],
      BAKING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
      OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: []
    };

    const transitionsPickup = {
      PLACED: ['BAKING', 'CANCELLED'],
      BAKING: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: []
    };

    const transitions =
      deliveryType === 'PICKUP' ? transitionsPickup : transitionsDelivery;

    const allowedNext = transitions[currentStatus] || [];

    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        message: `Cannot change status from ${currentStatus} to ${status} for ${deliveryType} order`
      });
    }

    order.status = status;

    if (status === 'DELIVERED' && order.payment) {
      order.payment.paymentStatus = 'SUCCESS';
    }

    const now = new Date();

    // placedAt safety
    if (status === 'PLACED' && !order.placedAt) {
      order.placedAt = now;
    }
    if (!order.placedAt && currentStatus === 'PLACED') {
      order.placedAt = now;
    }

    if (status === 'BAKING' && !order.bakingAt) {
      order.bakingAt = now;
    }

    if (status === 'OUT_FOR_DELIVERY' && !order.outForDeliveryAt) {
      order.outForDeliveryAt = now;
    }

    if (status === 'DELIVERED' && !order.deliveredAt) {
      order.deliveredAt = now;
    }

    if (status === 'CANCELLED' && !order.cancelledAt) {
      order.cancelledAt = now;
    }

    await order.save();
    emitOrderStatusUpdated(order);

    return res.json({ message: 'Status updated', order });
  } catch (err) {
    console.error('updateOrderStatus error:', err);
    return res
      .status(500)
      .json({ message: 'Unable to update order status right now.' });
  }
};

// DELETE /api/orders/:id
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const role = req.user.role;

    // CUSTOMER can only delete their own order
    if (role === 'CUSTOMER' && String(order.user) !== String(req.user._id)) {
      return res
        .status(403)
        .json({ message: 'You are not allowed to delete this order.' });
    }

    await order.deleteOne();

    return res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    console.error('deleteOrder error', err);
    return res
      .status(500)
      .json({ message: 'Unable to delete order right now.' });
  }
};