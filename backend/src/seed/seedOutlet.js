require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Outlet = require('../models/Outlet');

const run = async () => {
  try {
    await connectDB();

    const data = {
      name: 'Perfect Pizza – Singhpur Chauraha, Kalyanpur',
      code: 'KNP-SINGHPUR',
      address: 'Singhpur Chauraha, Kalyanpur, Kanpur Nagar',
      city: 'Kanpur',
      lat: 26.5388664,
      lng: 80.2610013,
      deliveryRadiusKm: 5,
      openHour: 10,
      closeHour: 23,
      phoneNumbers: ['+91-9889229198', '+91-7800775619'],
      isActive: true
    };

    const outlet = await Outlet.findOneAndUpdate(
      { code: data.code },
      data,
      { new: true, upsert: true }
    );

    console.log('✅ Default outlet saved/updated:');
    console.log('  Name:', outlet.name);
    console.log('  ID  :', outlet._id.toString());
  } catch (err) {
    console.error('seedOutlet error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

run();