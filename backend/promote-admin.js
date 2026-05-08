// Run: node promote-admin.js <phone>
require('dotenv').config();
const mongoose = require('mongoose');

const phone = process.argv[2] || '9876543210';

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const result = await mongoose.connection.db.collection('users').updateOne(
        { phone },
        { $set: { role: 'admin', name: 'Admin' } }
    );
    if (result.modifiedCount > 0) {
        console.log(`✅ User ${phone} promoted to admin!`);
    } else if (result.matchedCount > 0) {
        console.log(`ℹ️  User ${phone} is already admin.`);
    } else {
        console.log(`❌ User ${phone} not found. Login first to create the user.`);
    }
    process.exit(0);
}).catch(err => {
    console.error('DB error:', err.message);
    process.exit(1);
});
