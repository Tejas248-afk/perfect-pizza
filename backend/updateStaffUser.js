// updateStaffUser.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');

async function main() {
  await connectDB();

  // ==== YEH WALI VALUES APNE HISAB SE BHARO ====

  // Jis STAFF user ko update karna hai, uska CURRENT contact
  // (listStaffUsers.js ke output se uthao)
  const oldContact = '9999991111';    // PURANA number

  // Naya number jo login ke liye use karna hai:
  const newContact = '9889229198';    // agar number same rakhna hai to yahi rehne do

  // Naya password jo set karna hai:
  const newPassword = 'Admin@123';    // yahan strong password likho

  // Optional: naam bhi change karna ho to
  const newName = 'Main Admin';       // ya 'Kitchen User 1' etc.

  // ============================================

  const user = await User.findOne({
    contact: oldContact,
    role: { $in: ['ADMIN', 'KITCHEN'] }
  });

  if (!user) {
    console.log(
      'Staff user not found with contact:',
      oldContact
    );
    process.exit(0);
  }

  const hash = await bcrypt.hash(newPassword, 10);

  user.contact = newContact;
  user.password = hash;
  if (newName) user.name = newName;
  user.isActive = true;
  user.loginAttempts = 0;
  user.lockUntil = null;

  await user.save();

  console.log('Staff user updated:');
  console.log({
    id: user._id.toString(),
    name: user.name,
    contact: user.contact,
    role: user.role
  });
  console.log('\nUse these credentials to login (Staff tab par):');
  console.log('  Contact :', newContact);
  console.log('  Password:', newPassword);

  process.exit(0);
}

main().catch(err => {
  console.error('Error in updateStaffUser.js:', err);
  process.exit(1);
});