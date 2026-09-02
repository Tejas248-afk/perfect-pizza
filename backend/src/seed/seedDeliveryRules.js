require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const DeliveryRule = require('../models/DeliveryRule');

const run = async () => {
  try {
    await connectDB();

    const rules = [
      { minDistance: 0, maxDistance: 1, minCartValueForFreeDelivery: 199, baseDeliveryFee: 0, isActive: true },
      { minDistance: 1, maxDistance: 2, minCartValueForFreeDelivery: 249, baseDeliveryFee: 20, isActive: true },
      { minDistance: 2, maxDistance: 3, minCartValueForFreeDelivery: 299, baseDeliveryFee: 30, isActive: true },
      { minDistance: 3, maxDistance: 4, minCartValueForFreeDelivery: 349, baseDeliveryFee: 30, isActive: true },
      { minDistance: 4, maxDistance: 5, minCartValueForFreeDelivery: 399, baseDeliveryFee: 40, isActive: true }
    ];

    await DeliveryRule.deleteMany({});
    await DeliveryRule.insertMany(rules);

    console.log('✅ Delivery rules seeded successfully');
  } catch (err) {
    console.error('Seed delivery rules error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

run();