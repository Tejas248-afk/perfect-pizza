require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/Product');

const SIZES = ['REGULAR', 'MEDIUM', 'LARGE'];

const defaultCrusts = [
  {
    name: 'Classic',
    isAvailable: true,
    prices: SIZES.map(size => ({ size, price: 0 }))
  },
  {
    name: 'Cheese Burst',
    isAvailable: true,
    prices: [
      { size: 'REGULAR', price: 50 },
      { size: 'MEDIUM', price: 80 },
      { size: 'LARGE', price: 100 }
    ]
  },
  {
    name: 'Thin Crust',
    isAvailable: true,
    prices: [
      { size: 'REGULAR', price: 20 },
      { size: 'MEDIUM', price: 35 },
      { size: 'LARGE', price: 50 }
    ]
  }
];

// Common add-ons across pizzas
const commonAddOns = [
  {
    name: 'Extra Cheese',
    isRequired: false,
    multiple: false,
    isAvailable: true,
    prices: [
      { size: 'REGULAR', price: 30 },
      { size: 'MEDIUM', price: 50 },
      { size: 'LARGE', price: 70 }
    ]
  },
  {
    name: 'Jalapeño',
    isRequired: false,
    multiple: true,
    isAvailable: true,
    prices: [
      { size: 'REGULAR', price: 20 },
      { size: 'MEDIUM', price: 30 },
      { size: 'LARGE', price: 40 }
    ]
  },
  {
    name: 'Mushrooms',
    isRequired: false,
    multiple: true,
    isAvailable: true,
    prices: [
      { size: 'REGULAR', price: 20 },
      { size: 'MEDIUM', price: 30 },
      { size: 'LARGE', price: 40 }
    ]
  },
  // NEW: Cold Drink add-ons
  {
    name: 'Cold Drink 250ml',
    isRequired: false,
    multiple: true,
    isAvailable: true,
    prices: [
      { size: 'REGULAR', price: 40 },
      { size: 'MEDIUM', price: 40 },
      { size: 'LARGE', price: 40 }
    ]
  },
  {
    name: 'Cold Drink 1L',
    isRequired: false,
    multiple: true,
    isAvailable: true,
    prices: [
      { size: 'REGULAR', price: 80 },
      { size: 'MEDIUM', price: 80 },
      { size: 'LARGE', price: 80 }
    ]
  }
];

function makePizza({ name, category, description, prices }) {
  return {
    name,
    category,
    description,
    image: '',
    isVeg: true,
    isAvailable: true,
    sizes: [
      { name: 'REGULAR', price: prices.REGULAR },
      { name: 'MEDIUM', price: prices.MEDIUM },
      { name: 'LARGE', price: prices.LARGE }
    ],
    crusts: defaultCrusts,
    addOns: commonAddOns
  };
}

function makeSingleSizeProduct({
  name,
  category,
  description,
  price,
  isVeg = true
}) {
  return {
    name,
    category,
    description,
    image: '',
    isVeg,
    isAvailable: true,
    sizes: [{ name: 'REGULAR', price }],
    crusts: [
      {
        name: 'Default',
        isAvailable: true,
        prices: [{ size: 'REGULAR', price: 0 }]
      }
    ],
    // combos / sides par bhi cold-drink add-on allow kar rahe hain
    addOns: commonAddOns
  };
}

const run = async () => {
  try {
    await connectDB();

    const products = [];

    // ---------- CHEESY PIZZA MANIA ----------
    products.push(
      makePizza({
        name: 'Cheese Paneer Pizza',
        category: 'Cheesy Pizza Mania',
        description: 'Cheese + paneer + mozzarella.',
        prices: { REGULAR: 130, MEDIUM: 250, LARGE: 420 }
      }),
      makePizza({
        name: 'Paneer & Corn Pizza',
        category: 'Cheesy Pizza Mania',
        description: 'Paneer, sweet corn, mozzarella.',
        prices: { REGULAR: 130, MEDIUM: 250, LARGE: 420 }
      }),
      makePizza({
        name: 'Cheese Capsicum Pizza',
        category: 'Cheesy Pizza Mania',
        description: 'Onion, capsicum, cheese.',
        prices: { REGULAR: 120, MEDIUM: 230, LARGE: 330 }
      }),
      makePizza({
        name: 'Cheese Onion Pizza',
        category: 'Cheesy Pizza Mania',
        description: 'Onion, mozzarella cheese.',
        prices: { REGULAR: 110, MEDIUM: 220, LARGE: 320 }
      })
    );

    // ---------- PREMIUM PIZZA MANIA ----------
    products.push(
      makePizza({
        name: 'Veggi Special Pizza',
        category: 'Premium Pizza Mania',
        description: 'Onion, capsicum, tomato.',
        prices: { REGULAR: 130, MEDIUM: 240, LARGE: 370 }
      }),
      makePizza({
        name: 'Single Cheese Margherita',
        category: 'Premium Pizza Mania',
        description: 'Single layer mozzarella.',
        prices: { REGULAR: 130, MEDIUM: 240, LARGE: 370 }
      }),
      makePizza({
        name: 'Spring Filling Pizza',
        category: 'Premium Pizza Mania',
        description: 'Onion, capsicum, paneer, black olives.',
        prices: { REGULAR: 140, MEDIUM: 250, LARGE: 380 }
      }),
      makePizza({
        name: 'Tandoori Paneer Tikka Pizza',
        category: 'Premium Pizza Mania',
        description: 'Onion, paneer tikka, mozzarella.',
        prices: { REGULAR: 140, MEDIUM: 260, LARGE: 390 }
      })
    );

    // ---------- EXOTIC VEG ----------
    products.push(
      makePizza({
        name: 'Paneer Pepper Pizza',
        category: 'Exotic Veg',
        description: 'Paneer, red pepper, capsicum.',
        prices: { REGULAR: 170, MEDIUM: 320, LARGE: 460 }
      }),
      makePizza({
        name: 'Cheese Corn Pizza',
        category: 'Exotic Veg',
        description: 'Cheese, corn flavours.',
        prices: { REGULAR: 170, MEDIUM: 320, LARGE: 460 }
      }),
      makePizza({
        name: 'Green Maxicana Pizza',
        category: 'Exotic Veg',
        description: 'Onion, capsicum, tomato, mushroom.',
        prices: { REGULAR: 170, MEDIUM: 320, LARGE: 460 }
      })
    );

    // ---------- VEG SPECIAL ----------
    products.push(
      makePizza({
        name: 'Tangy Spice Pizza',
        category: 'Veg Special',
        description: 'Red pepper, jalapeño, onion.',
        prices: { REGULAR: 210, MEDIUM: 400, LARGE: 560 }
      }),
      makePizza({
        name: 'Makhani Paneer Tikka Pizza',
        category: 'Veg Special',
        description: 'Onion, paneer tikka, makhani sauce.',
        prices: { REGULAR: 210, MEDIUM: 400, LARGE: 560 }
      }),
      makePizza({
        name: 'Veg Supreme Pizza',
        category: 'Veg Special',
        description: 'Onion, capsicum, corn, black olives, jalapeño.',
        prices: { REGULAR: 210, MEDIUM: 400, LARGE: 560 }
      })
    );

    // ---------- PP SPECIAL ----------
    products.push(
      makePizza({
        name: 'Perfect Pizza Special Pizza',
        category: 'PP Special',
        description: 'Onion, capsicum, paneer, mushroom, black olives.',
        prices: { REGULAR: 230, MEDIUM: 430, LARGE: 590 }
      })
    );

    // ---------- PIZZA MENIA 7" ----------
    products.push(
      makeSingleSizeProduct({
        name: 'Paneer & Onion 7" Pizza',
        category: 'Pizza Menia 7 inch',
        description: 'Small paneer & onion pizza.',
        price: 110
      }),
      makeSingleSizeProduct({
        name: 'Onion & Capsicum 7" Pizza',
        category: 'Pizza Menia 7 inch',
        description: 'Small onion capsicum pizza.',
        price: 110
      })
    );

    // ---------- SIDE ORDERS / DESSERT ----------
    products.push(
      makeSingleSizeProduct({
        name: 'Stuffed Bread Cheesy (6 Sticks)',
        category: 'Side Orders / Dessert',
        description: 'Cheesy garlic stuffed bread sticks.',
        price: 110
      }),
      makeSingleSizeProduct({
        name: 'Garlic Bread (8 Sticks)',
        category: 'Side Orders / Dessert',
        description: 'Classic garlic bread sticks.',
        price: 110
      }),
      makeSingleSizeProduct({
        name: 'Choco Lava Cake',
        category: 'Side Orders / Dessert',
        description: 'Warm chocolate lava cake.',
        price: 80
      }),
      makeSingleSizeProduct({
        name: 'Red Pasta',
        category: 'Side Orders / Dessert',
        description: 'Red sauce pasta.',
        price: 120
      }),
      makeSingleSizeProduct({
        name: 'White Pasta',
        category: 'Side Orders / Dessert',
        description: 'White sauce pasta.',
        price: 120
      })
    );

    // ---------- BURGERS ----------
    products.push(
      makeSingleSizeProduct({
        name: 'Veg Tikki Burger',
        category: 'Burgers',
        description: 'Crispy veg tikki patty.',
        price: 60
      }),
      makeSingleSizeProduct({
        name: 'Paneer Tikki Burger',
        category: 'Burgers',
        description: 'Paneer tikki patty burger.',
        price: 80
      }),
      makeSingleSizeProduct({
        name: 'Classic Cheese Burger',
        category: 'Burgers',
        description: 'Cheese slice, veg patty.',
        price: 70
      })
    );

    // ---------- SUPER SAVING COMBOS ----------
    products.push(
      makeSingleSizeProduct({
        name: 'Zingy Pizza Combo',
        category: 'Super Saving Combos',
        description:
          'Onion pizza + 2 zingy parcels + cold drink 250ml.',
        price: 140
      }),
      makeSingleSizeProduct({
        name: 'Garlic Pizza Combo',
        category: 'Super Saving Combos',
        description:
          'Paneer onion pizza + garlic bread + cold drink 250ml.',
        price: 170
      }),
      makeSingleSizeProduct({
        name: 'Meal For 2',
        category: 'Super Saving Combos',
        description:
          '2 single topping pizzas + 1 garlic bread + cold drink 250ml.',
        price: 210
      }),
      makeSingleSizeProduct({
        name: 'Meal For 3',
        category: 'Super Saving Combos',
        description:
          '3 single topping pizzas + garlic bread + choco lava + cold drink 1L.',
        price: 380
      })
    );

    // ---------- EVERYDAY COMBOS ----------
    products.push(
      makeSingleSizeProduct({
        name: 'Combo-A',
        category: 'Everyday Combos',
        description: 'Onion capsicum/tomato corn pizza + cold drink 250ml.',
        price: 99
      }),
      makeSingleSizeProduct({
        name: 'Combo-B',
        category: 'Everyday Combos',
        description: 'Cheese onion/tomato pizza + cold drink 250ml.',
        price: 99
      }),
      makeSingleSizeProduct({
        name: 'Combo-G',
        category: 'Everyday Combos',
        description:
          'Tomato corn pizza + tomato pizza + cold drink 250ml.',
        price: 149
      }),
      makeSingleSizeProduct({
        name: 'Burger Pizza Combo',
        category: 'Everyday Combos',
        description:
          'Paneer onion pizza + burger + cold drink 250ml.',
        price: 149
      })
    );

    await Product.deleteMany({});
    await Product.insertMany(products);

    console.log(`✅ Seeded ${products.length} products (pizzas + combos + sides).`);
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

run();