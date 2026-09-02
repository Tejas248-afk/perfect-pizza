// createKitchenUser.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');

async function main() {
  await connectDB();

  // ==== YEH VALUES TUMHARE LIYE FIX KAR RAHA HOON ====

  const contact = '7800775619';       // Kitchen login ka number
  const password = 'Kitchen@123';     // Kitchen ka password (chahe to badal sakte ho)
  const name = 'Kitchen User';        // Kitchen user ka naam

  // ================================================

  // Check agar koi user already is contact se exist karta hai
  const existing = await User.findOne({ contact });

  if (existing) {
    console.log('NOTE: A user with this contact already exists:');
    console.log({
      id: existing._id.toString(),
      name: existing.name,
      role: existing.role
    });
    console.log('Isko ab KITCHEN account me convert/update karenge.\n');
  }

  const hash = await bcrypt.hash(password, 10);

  const user = await User.findOneAndUpdate(
    { contact },
    {
      name,
      contact,
      password: hash,
      role: User.ROLES.KITCHEN,
      isActive: true,
      loginAttempts: 0,
      lockUntil: null
    },
    { upsert: true, new: true }
  );

  console.log('Kitchen user saved/updated:');
  console.log({
    id: user._id.toString(),
    name: user.name,
    contact: user.contact,
    role: user.role
  });
  console.log('\nUse these credentials to login (Staff tab par):');
  console.log('  Contact :', contact);
  console.log('  Password:', password);

  process.exit(0);
}

main().catch(err => {
  console.error('Error in createKitchenUser.js:', err);
  process.exit(1);
});