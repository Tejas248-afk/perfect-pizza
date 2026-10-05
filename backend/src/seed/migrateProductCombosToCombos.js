// src/seed/migrateProductCombosToCombos.js
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/Product');
const Combo = require('../models/Combo');

const run = async () => {
  try {
    await connectDB();

    // Ye woh categories hain jisme tumne combos seed kiye the
    const comboCategories = ['Super Saving Combos', 'Everyday Combos'];

    const products = await Product.find({
      category: { $in: comboCategories },
    }).lean();

    console.log(`Found ${products.length} combo products in Product collection`);

    for (const p of products) {
      // Agar same name ka combo already exist hai to skip
      const exists = await Combo.findOne({ name: p.name }).lean();
      if (exists) {
        console.log(`Skipping existing combo: ${p.name}`);
        continue;
      }

      const comboPrice =
        Array.isArray(p.sizes) && p.sizes.length > 0
          ? p.sizes[0].price
          : 0;

      // Abhi items ka detailed breakdown Product me nahi hai,
      // isliye ek simple placeholder item bana rahe hain.
      // Baad me tum Combo Builder se isko proper items me edit kar sakte ho.
      await Combo.create({
        name: p.name,
        description: p.description,
        items: [
          {
            productName:
              p.description ||
              p.name ||
              'Combo item',
            size: 'ANY',
            quantity: 1,
            group: 'Combo',
          },
        ],
        regularPrice: undefined,
        comboPrice,
        isActive: p.isAvailable !== false,
        showOnWebsite: true,
      });

      console.log(`Created combo from product: ${p.name}`);
    }

    console.log('✅ Migration complete.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

run();