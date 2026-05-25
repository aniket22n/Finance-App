// Drops all app collections for a clean E2E test run.
// Usage: node reset-db.js
// Reads MONGO_URI from .env or defaults to localhost.
require('dotenv').config();
const mongoose = require('mongoose');

const WIPE_COLLECTIONS = ['groups', 'payments', 'emicycles', 'reminderLogs', 'notifications', 'accountrequests'];

async function reset() {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/emigroup';
    await mongoose.connect(uri);
    console.log('✅ Connected to:', uri.replace(/:\/\/.*@/, '://***@'));

    const db = mongoose.connection.db;

    // Delete all non-admin users
    const userResult = await db.collection('users').deleteMany({ role: { $ne: 'admin' } });
    if (userResult.deletedCount > 0) {
        console.log(`🗑️  users: deleted ${userResult.deletedCount} non-admin docs`);
    }

    let admins = await db.collection('users').find({ role: 'admin' }).toArray();

    // If no admin exists, re-create the default one
    if (admins.length === 0) {
        await db.collection('users').insertOne({
            phone: '9876543210',
            name: 'Admin',
            firstName: 'Admin',
            lastName: '',
            role: 'admin',
            status: 'approved',
            isActive: true,
            otp: '',
            otpExpiresAt: null,
            expoPushToken: '',
            avatar: '',
            email: '',
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        admins = [{ phone: '9876543210' }];
        console.log('👤 Re-created default admin (9876543210)');
    } else {
        console.log(`✅ Kept ${admins.length} admin account(s): ${admins.map(a => a.phone).join(', ')}`);
    }

    // Wipe all other collections
    for (const col of WIPE_COLLECTIONS) {
        const result = await db.collection(col).deleteMany({});
        if (result.deletedCount > 0) {
            console.log(`🗑️  ${col}: deleted ${result.deletedCount} docs`);
        }
    }

    console.log('\n✅ Done. Admin:', admins.map(a => a.phone).join(', '), '| OTP: DEV_OTP (check .env)');
    process.exit(0);
}

reset().catch(err => {
    console.error('❌ Reset failed:', err.message);
    process.exit(1);
});
