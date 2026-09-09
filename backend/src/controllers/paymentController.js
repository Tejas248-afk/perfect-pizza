// src/controllers/paymentController.js
const Joi = require('joi');
const crypto = require('crypto');
const Order = require('../models/Order');
const Outlet = require('../models/Outlet');
const User = require('../models/User');
const { buildOrderPreview } = require('../services/orderService');
const { emitNewOrder } = require('../sockets/socket');

const PAYU_KEY = process.env.PAYU_KEY;
const PAYU_SALT = process.env.PAYU_SALT;
const PAYU_BASE_URL = process.env.PAYU_BASE_URL || 'https://test.payu.in';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5000';
const DEFAULT_OUTLET_ID = process.env.DEFAULT_OUTLET_ID;

/* ---------- Validation (same as orderController) ---------- */

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

/* ---------- Helpers ---------- */

async function resolveOutlet(requestOutletId) {
  const outletId = requestOutletId || DEFAULT_OUTLET_ID;
  if (!outletId) {
    const err = new Error('Outlet not configured.');
    err.statusCode = 500;
    throw err;
  }

  const outlet = await Outlet.findById(outletId);
  if (!outlet || !outlet.isActive) {
    const err = new Error('Selected outlet is not available.');
    err.statusCode = 400;
    throw err;
  }
  return outlet;
}

function ensureStoreOpen(outlet) {
  // India time ki jagah local time use kiya gaya tha,
  // chaaho to yahan bhi Asia/Kolkata convert kar sakte ho.
  const now = new Date();
  const hour = now.getHours();

  const open = typeof outlet.openHour === 'number' ? outlet.openHour : 10;
  const close = typeof outlet.closeHour === 'number' ? outlet.closeHour : 23;

  if (hour < open || hour >= close) {
    const err = new Error(
      `Store "${outlet.name}" abhi band hai. Orders ${open}:00 se ${close}:00 tak allowed hain.`
    );
    err.statusCode = 400;
    throw err;
  }
}

function generateTxnId() {
  return 'PP' + Date.now() + Math.floor(Math.random() * 1000);
}

/* ---------- 1) /api/payment/payu/init ---------- */

exports.initPayuPayment = async (req, res) => {
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

    // Order preview (subtotal, delivery, discount, grandTotal, etc.)
    const preview = await buildOrderPreview({
      user: req.user,
      outlet,
      ...value
    });

    const txnid = generateTxnId();

    // 1. DB me order create karo
    // IMPORTANT CHANGE:
    // Pehle yahan status: 'PLACED' tha, jis se bina payment ke bhi
    // kitchen / my orders me order dikhta tha.
    // Ab hum yahan 'PENDING_PAYMENT' rakh rahe hain.
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
      payment: {
        paymentType: 'PAYU',
        paymentStatus: 'PENDING',
        paymentReference: '',
        payuOrderId: txnid, // txnid se map kar rahe
        payuTxnId: ''
      },
      status: 'PENDING_PAYMENT'
    });

    // 2. PayU ke liye params banao
    const amount = Number(preview.grandTotal || 0).toFixed(2);
    const productinfo = 'Perfect Pizza Order';

    const firstname = req.user?.name || 'Customer';
    const email = req.user?.email || 'test@example.com';
    const phone = req.user?.contact || '9999999999';

    const callbackUrl = `${APP_BASE_URL}/api/payment/payu/callback`;

    const payuParams = {
      key: PAYU_KEY,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
      surl: callbackUrl,
      furl: callbackUrl
      // udf1..udf10 blank rahenge
    };

    // --------- Request hash (standard, no UDFs) ---------
    // key|txnid|amount|productinfo|firstname|email|||||||||||salt
    const hashString =
      PAYU_KEY +
      '|' +
      txnid +
      '|' +
      amount +
      '|' +
      productinfo +
      '|' +
      firstname +
      '|' +
      email +
      '|||||||||||' +
      PAYU_SALT;

    const hash = crypto
      .createHash('sha512')
      .update(hashString)
      .digest('hex');

    return res.json({
      orderId: order._id,
      payuUrl: `${PAYU_BASE_URL}/_payment`,
      params: payuParams,
      hash
    });
  } catch (err) {
    console.error('initPayuPayment error:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({
      message:
        err.statusCode && status < 500
          ? err.message
          : 'Unable to start online payment right now.'
    });
  }
};

/* ---------- 2) /api/payment/payu/callback ---------- */

exports.handlePayuCallback = async (req, res) => {
  try {
    const {
      key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      status,
      hash: receivedHash,
      mihpayid,
      error_Message,
      additionalCharges
    } = req.body;

    // 1) Hash verify (standard response formula, no UDFs)
    // hash = sha512( [additionalCharges|]salt|status|||||||||||email|firstname|productinfo|amount|txnid|key )
    let hashString =
      PAYU_SALT +
      '|' +
      status +
      '|||||||||||' +
      email +
      '|' +
      firstname +
      '|' +
      productinfo +
      '|' +
      amount +
      '|' +
      txnid +
      '|' +
      PAYU_KEY;

    if (additionalCharges) {
      hashString = additionalCharges + '|' + hashString;
    }

    const calculatedHash = crypto
      .createHash('sha512')
      .update(hashString)
      .digest('hex');

    if (calculatedHash !== receivedHash) {
      console.error('PayU hash mismatch (callback)');
      return res.status(400).send('Hash mismatch');
    }

    // 2) Order fetch: txnid se (kyunki payuOrderId = txnid)
    const order = await Order.findOne({
      'payment.payuOrderId': txnid
    }).populate('user', 'rewardCoins name contact');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Payment fields update
    order.payment = order.payment || {};
    order.payment.rawGatewayResponse = req.body;
    order.payment.payuTxnId = mihpayid || order.payment.payuTxnId;
    order.payment.paymentReference = mihpayid || order.payment.paymentReference;

    if (status === 'success') {
      order.payment.paymentStatus = 'SUCCESS';

      // IMPORTANT: status ko ab yahan PLACED kar rahe hain.
      // Isi moment se kitchen & customer list me order dikhega.
      order.status = 'PLACED';

      // Rewards: sirf success pe adjust
      try {
        const user = order.user;
        const currentCoins = Number(user.rewardCoins || 0);
        const used = Number(order.rewardCoinsUsed || 0);
        const earned = Number(order.rewardCoinsEarned || 0);

        let newBalance = currentCoins - used + earned;
        if (newBalance < 0) newBalance = 0;

        user.rewardCoins = newBalance;
        await user.save();
      } catch (uErr) {
        console.error('Failed to update reward coins (PAYU):', uErr);
      }

      await order.save();

      // Abhi payment success hai, abhi order kitchen ko dikhaao
      emitNewOrder(order);

      return res.send(`
        <html>
          <body style="font-family: sans-serif; text-align:center; padding:40px;">
            <h2>Payment Successful ✅</h2>
            <p>Thank you for your order!</p>
            <p><strong>Order ID:</strong> ${order._id}</p>
            <p><strong>Transaction ID:</strong> ${mihpayid || ''}</p>
            <a href="/my-orders.html">Go to My Orders</a>
          </body>
        </html>
      `);
    } else {
      order.payment.paymentStatus = 'FAILED';
      order.status = 'CANCELLED';
      await order.save();

      return res.send(`
        <html>
          <body style="font-family: sans-serif; text-align:center; padding:40px;">
            <h2>Payment Failed ❌</h2>
            <p>${error_Message || 'Payment was not completed.'}</p>
            <a href="/checkout.html">Go back to Checkout</a>
          </body>
        </html>
      `);
    }
  } catch (err) {
    console.error('handlePayuCallback error:', err);
    return res.status(500).send('Something went wrong while processing payment.');
  }
};