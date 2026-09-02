require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

const run = async () => {
  try {
    await connectDB();

    const usersToCreate = [
      {
        name: 'Perfect Pizza Admin',
        contact: '9999991111',
        password: 'AdminPass1!',
        role: User.ROLES.ADMIN
      },
      {
        name: 'Perfect Pizza Kitchen',
        contact: '9999992222',
        password: 'KitchenPass1!',
        role: User.ROLES.KITCHEN
      }
    ];

    for (const u of usersToCreate) {
      const existing = await User.findOne({ contact: u.contact });
      if (existing) {
        console.log(`User already exists: ${u.contact}`);
        continue;
      }

      const hashed = await bcrypt.hash(u.password, 10);

      const created = await User.create({
        name: u.name,
        contact: u.contact,
        password: hashed,
        role: u.role
      });

      console.log(
        `Created ${u.role} user:`,
        u.contact,
        'id:',
        created._id.toString()
      );
    }
  } catch (err) {
    console.error('Seed users error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

run();