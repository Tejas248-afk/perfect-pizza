// listStaffUsers.js
require('dotenv').config();
const connectDB = require('./src/config/db');
const User = require('./src/models/User');

async function main() {
  await connectDB();

  const staff = await User.find({
    role: { $in: ['ADMIN', 'KITCHEN'] }
  }).select('name contact role createdAt');

  console.log('--- Staff Users (ADMIN + KITCHEN) ---');
  if (!staff.length) {
    console.log('No staff users found.');
  } else {
    staff.forEach(u => {
      console.log({
        id: u._id.toString(),
        name: u.name,
        contact: u.contact,
        role: u.role,
        createdAt: u.createdAt
      });
    });
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error in listStaffUsers.js:', err);
  process.exit(1);
});