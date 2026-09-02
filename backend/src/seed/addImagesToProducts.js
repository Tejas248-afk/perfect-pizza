require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/Product');

const run = async () => {
  try {
    await connectDB();

    // Generic images (free stock photos – tum baad me apne CDN URLs se replace kar sakte ho)
    const PIZZA_IMG =
      'https://images.pexels.com/photos/4109084/pexels-photo-4109084.jpeg?auto=compress&cs=tinysrgb&w=600';
    const EXOTIC_PIZZA_IMG =
      'https://images.pexels.com/photos/1596881/pexels-photo-1596881.jpeg?auto=compress&cs=tinysrgb&w=600';
    const COMBO_IMG =
      'https://images.pexels.com/photos/2619967/pexels-photo-2619967.jpeg?auto=compress&cs=tinysrgb&w=600';
    const SIDE_IMG =
      'https://images.pexels.com/photos/4109132/pexels-photo-4109132.jpeg?auto=compress&cs=tinysrgb&w=600';
    const BURGER_IMG =
      'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=600';
    const PASTA_IMG =
      'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=600';

    const products = await Product.find();

    for (const p of products) {
      let img = '';

      const cat = (p.category || '').toLowerCase();
      const name = (p.name || '').toLowerCase();

      if (cat.includes('burger')) {
        img = BURGER_IMG;
      } else if (cat.includes('side') || cat.includes('dessert')) {
        img = SIDE_IMG;
      } else if (cat.includes('combo') || cat.includes('super saving')) {
        img = COMBO_IMG;
      } else if (cat.includes('maggie') || cat.includes('pasta')) {
        img = PASTA_IMG;
      } else if (cat.includes('exotic') || name.includes('supreme')) {
        img = EXOTIC_PIZZA_IMG;
      } else if (cat.includes('pizza') || name.includes('pizza')) {
        img = PIZZA_IMG;
      } else {
        // default pizza-ish
        img = PIZZA_IMG;
      }

      // agar already image set hai aur tum overwrite nahi karna chahte to skip
      // if (p.image) continue;

      p.image = img;
      await p.save();
      console.log('Updated image:', p.name);
    }

    console.log('✅ Images added/updated for existing products.');
  } catch (err) {
    console.error('addImagesToProducts error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

run();