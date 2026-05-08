// Run: node seed-demo.js
require('dotenv').config();
const mongoose = require('mongoose');

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. Create demo users (admin + 20 members)
    const demoUsers = [
        { phone: '9876543210', name: 'Admin', role: 'admin' },
        { phone: '9000000001', name: 'Rajesh Kumar', role: 'member' },
        { phone: '9000000002', name: 'Priya Sharma', role: 'member' },
        { phone: '9000000003', name: 'Amit Patel', role: 'member' },
        { phone: '9000000004', name: 'Sneha Reddy', role: 'member' },
        { phone: '9000000005', name: 'Vikram Singh', role: 'member' },
        { phone: '9000000006', name: 'Anjali Gupta', role: 'member' },
        { phone: '9000000007', name: 'Suresh Nair', role: 'member' },
        { phone: '9000000008', name: 'Deepa Iyer', role: 'member' },
        { phone: '9000000009', name: 'Kiran Rao', role: 'member' },
        { phone: '9000000010', name: 'Meena Devi', role: 'member' },
        { phone: '9000000011', name: 'Ravi Verma', role: 'member' },
        { phone: '9000000012', name: 'Sunita Joshi', role: 'member' },
        { phone: '9000000013', name: 'Manoj Tiwari', role: 'member' },
        { phone: '9000000014', name: 'Kavita Mishra', role: 'member' },
        { phone: '9000000015', name: 'Arjun Mehta', role: 'member' },
        { phone: '9000000016', name: 'Pooja Sharma', role: 'member' },
        { phone: '9000000017', name: 'Sanjay Das', role: 'member' },
        { phone: '9000000018', name: 'Lakshmi Menon', role: 'member' },
        { phone: '9000000019', name: 'Rahul Pandey', role: 'member' },
        { phone: '9000000020', name: 'Nisha Agarwal', role: 'member' },
    ];

    const userIds = [];
    for (const u of demoUsers) {
        const result = await db.collection('users').updateOne(
            { phone: u.phone },
            { $set: u, $setOnInsert: { otp: '1234', createdAt: new Date() } },
            { upsert: true }
        );
        const user = await db.collection('users').findOne({ phone: u.phone });
        userIds.push(user._id);
    }
    console.log(`✅ Created/updated ${demoUsers.length} users`);

    const adminId = userIds[0];
    const memberIds = userIds.slice(1); // 20 members

    // 2. Create a demo pot group
    const existingGroup = await db.collection('groups').findOne({ name: 'Demo POT - Gold 500K' });
    if (existingGroup) {
        await db.collection('groups').deleteOne({ _id: existingGroup._id });
        await db.collection('emicycles').deleteMany({ group: existingGroup._id });
        await db.collection('payments').deleteMany({ group: existingGroup._id });
        console.log('🗑️  Cleaned up existing demo group');
    }

    const group = {
        name: 'Demo POT - Gold 500K',
        description: 'Demo pot group with 20 members. ₹5,00,000 pot, ₹30,000 EMI, ₹27,000 reduced EMI for winner.',
        potAmount: 500000,
        emiAmount: 30000,
        reducedEmi: 27000,
        minMembers: 20,
        maxMembers: 20,
        totalMonths: 20,
        currentMonth: 3,
        status: 'active',
        members: memberIds,
        createdBy: adminId,
        startDate: new Date('2026-01-01'),
        monthlyConfig: [
            { month: 1, potAmount: 500000, emiAmount: 30000, reducedEmi: 27000 },
            { month: 2, potAmount: 500000, emiAmount: 30000, reducedEmi: 27000 },
            { month: 3, potAmount: 500000, emiAmount: 30000, reducedEmi: 27000 },
            { month: 5, potAmount: 520000, emiAmount: 31000, reducedEmi: 28000 },  // custom
            { month: 10, potAmount: 550000, emiAmount: 32000, reducedEmi: 29000 }, // custom
            { month: 15, potAmount: 480000, emiAmount: 28000, reducedEmi: 25000 }, // custom
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const insertResult = await db.collection('groups').insertOne(group);
    const groupId = insertResult.insertedId;
    console.log(`✅ Created demo group: "${group.name}" (ID: ${groupId})`);

    // 3. Create 3 past EMI cycles (months 1-3 completed)
    const pastWinners = [memberIds[2], memberIds[7], memberIds[14]]; // Amit, Deepa, Arjun
    const winnerNames = ['Amit Patel', 'Deepa Iyer', 'Arjun Mehta'];

    for (let m = 1; m <= 3; m++) {
        const cycle = {
            group: groupId,
            month: m,
            potAmount: 500000,
            emiAmount: 30000,
            reducedEmi: 27000,
            winner: pastWinners[m - 1],
            status: 'completed',
            completedAt: new Date(`2026-0${m}-28`),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const cycleResult = await db.collection('emicycles').insertOne(cycle);

        // Create payments for each member
        for (let i = 0; i < memberIds.length; i++) {
            const isWinner = memberIds[i].equals(pastWinners[m - 1]);
            await db.collection('payments').insertOne({
                user: memberIds[i],
                group: groupId,
                cycle: cycleResult.insertedId,
                month: m,
                amount: isWinner ? 27000 : 30000,
                status: 'verified',
                method: 'upi',
                upiTransactionId: `UPI${m}${String(i + 1).padStart(3, '0')}`,
                verifiedBy: adminId,
                verifiedAt: new Date(`2026-0${m}-${15 + i}`),
                createdAt: new Date(`2026-0${m}-${10 + i}`),
            });
        }
        console.log(`  ✅ Month ${m}: Winner = ${winnerNames[m - 1]}, 20 payments verified`);
    }

    console.log('\n🎉 Demo data seeded successfully!');
    console.log('─'.repeat(50));
    console.log('📋 Login credentials:');
    console.log('   Admin:  phone = 9876543210, OTP = 1234');
    console.log('   Member: phone = 9000000001, OTP = 1234');
    console.log('─'.repeat(50));
    console.log(`📊 Group: "${group.name}"`);
    console.log(`   Members: 20 | Months: 20 | Current: Month 3`);
    console.log(`   POT: ₹5,00,000 | EMI: ₹30,000 | Reduced: ₹27,000`);
    console.log(`   3 completed cycles with verified payments`);
    console.log(`   3 months with custom config (months 5, 10, 15)`);
    console.log('─'.repeat(50));

    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
});
