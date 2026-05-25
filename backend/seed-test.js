// Seed realistic test data — keeps existing admin, adds 6 members + 2 groups + payments.
// Usage: node seed-test.js
// Login: any member phone below, OTP = DEV_OTP (check .env), PIN = 1234
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function seed() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/emigroup');
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // ── Clean non-admin data ──────────────────────────────────────────────────
    await db.collection('users').deleteMany({ role: { $ne: 'admin' } });
    for (const col of ['groups', 'payments', 'emicycles', 'accountrequests', 'notifications']) {
        await db.collection(col).deleteMany({});
    }

    const admin = await db.collection('users').findOne({ role: 'admin' });
    if (!admin) { console.error('❌ No admin found. Run reset-db.js first.'); process.exit(1); }
    const adminId = admin._id;
    console.log(`👤 Admin: ${admin.phone} (${admin.name})`);

    // ── Members ───────────────────────────────────────────────────────────────
    const pinHash = await bcrypt.hash('1234', 10);

    const memberDefs = [
        { phone: '9000000001', firstName: 'Rajesh',  lastName: 'Kumar'  },
        { phone: '9000000002', firstName: 'Priya',   lastName: 'Sharma' },
        { phone: '9000000003', firstName: 'Amit',    lastName: 'Patel'  },
        { phone: '9000000004', firstName: 'Sneha',   lastName: 'Reddy'  },
        { phone: '9000000005', firstName: 'Vikram',  lastName: 'Singh'  },
        { phone: '9000000006', firstName: 'Anjali',  lastName: 'Gupta'  },
    ];

    const memberIds = [];
    for (const m of memberDefs) {
        const { insertedId } = await db.collection('users').insertOne({
            phone: m.phone,
            firstName: m.firstName,
            lastName: m.lastName,
            name: `${m.firstName} ${m.lastName}`,
            role: 'member',
            status: 'approved',
            isActive: true,
            pin: pinHash,
            otp: '',
            otpExpiresAt: null,
            expoPushToken: '',
            avatar: '',
            email: '',
            approvedAt: new Date(),
            approvedBy: adminId,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        memberIds.push(insertedId);
    }
    console.log(`✅ Created ${memberIds.length} members (${memberDefs.map(m => m.phone).join(', ')})`);

    // ── Group 1: Gold Chit — 6 members, ₹10K EMI, month 3 of 6 ──────────────
    const g1 = await db.collection('groups').insertOne({
        name: 'Gold Chit — ₹10K',
        description: '6-member group. ₹10,000 monthly EMI. POT = ₹60,000.',
        potAmount: 60000,
        emiAmount: 10000,
        reducedEmi: 9000,
        monthlyConfig: [],
        minMembers: 2,
        maxMembers: 10,
        totalMonths: 6,
        currentMonth: 3,
        dueDay: 5,
        reminderDaysBefore: 3,
        status: 'active',
        members: memberIds,
        createdBy: adminId,
        startDate: new Date('2026-03-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    const gid1 = g1.insertedId;

    // Group 1 — Month 1: all 6 members verified, winner = Rajesh
    const c1 = await db.collection('emicycles').insertOne({
        group: gid1, month: 1, winner: memberIds[0],
        emiAmount: 10000, reducedEmi: 9000, potAmount: 60000,
        status: 'completed', completedAt: new Date('2026-03-28'),
        createdAt: new Date('2026-03-01'), updatedAt: new Date('2026-03-28'),
    });
    for (let i = 0; i < 6; i++) {
        const isWinner = i === 0;
        await db.collection('payments').insertOne({
            user: memberIds[i], group: gid1, month: 1,
            amount: isWinner ? 9000 : 10000, status: 'verified',
            paymentMethod: 'upi',
            upiTransactionId: `UPI26030${i + 1}`,
            paidAt: new Date(`2026-03-0${i + 2}`),
            verifiedAt: new Date(`2026-03-${10 + i}`),
            verifiedBy: adminId, notes: '',
            createdAt: new Date(`2026-03-0${i + 2}`), updatedAt: new Date(),
        });
    }
    console.log('  ✅ Group 1 — Month 1: 6 verified payments, winner = Rajesh Kumar');

    // Group 1 — Month 2: all 6 members verified, winner = Priya
    await db.collection('emicycles').insertOne({
        group: gid1, month: 2, winner: memberIds[1],
        emiAmount: 10000, reducedEmi: 9000, potAmount: 60000,
        status: 'completed', completedAt: new Date('2026-04-28'),
        createdAt: new Date('2026-04-01'), updatedAt: new Date('2026-04-28'),
    });
    for (let i = 0; i < 6; i++) {
        const isWinner = i === 1;
        await db.collection('payments').insertOne({
            user: memberIds[i], group: gid1, month: 2,
            amount: isWinner ? 9000 : 10000, status: 'verified',
            paymentMethod: i % 2 === 0 ? 'upi' : 'bank',
            upiTransactionId: `UPI26040${i + 1}`,
            paidAt: new Date(`2026-04-0${i + 2}`),
            verifiedAt: new Date(`2026-04-${10 + i}`),
            verifiedBy: adminId, notes: '',
            createdAt: new Date(`2026-04-0${i + 2}`), updatedAt: new Date(),
        });
    }
    console.log('  ✅ Group 1 — Month 2: 6 verified payments, winner = Priya Sharma');

    // Group 1 — Month 3 (current): mixed states for testing
    // Rajesh (winner m1, reduced ₹9K): verified
    await db.collection('payments').insertOne({
        user: memberIds[0], group: gid1, month: 3,
        amount: 9000, status: 'verified', paymentMethod: 'upi',
        upiTransactionId: 'UPI2605001',
        paidAt: new Date('2026-05-02'), verifiedAt: new Date('2026-05-03'),
        verifiedBy: adminId, notes: '',
        createdAt: new Date('2026-05-02'), updatedAt: new Date(),
    });
    // Priya (winner m2, reduced ₹9K): paid — awaiting admin verification
    await db.collection('payments').insertOne({
        user: memberIds[1], group: gid1, month: 3,
        amount: 9000, status: 'paid', paymentMethod: 'bank',
        upiTransactionId: 'NEFT2605002',
        paidAt: new Date('2026-05-04'),
        verifiedAt: null, verifiedBy: null, notes: '',
        createdAt: new Date('2026-05-04'), updatedAt: new Date(),
    });
    // Amit: paid — awaiting admin verification
    await db.collection('payments').insertOne({
        user: memberIds[2], group: gid1, month: 3,
        amount: 10000, status: 'paid', paymentMethod: 'upi',
        upiTransactionId: 'UPI2605003',
        paidAt: new Date('2026-05-05'),
        verifiedAt: null, verifiedBy: null, notes: '',
        createdAt: new Date('2026-05-05'), updatedAt: new Date(),
    });
    // Sneha: rejected — needs to resubmit
    await db.collection('payments').insertOne({
        user: memberIds[3], group: gid1, month: 3,
        amount: 10000, status: 'rejected', paymentMethod: 'upi',
        upiTransactionId: 'UPI2605004BAD',
        paidAt: new Date('2026-05-04'),
        verifiedAt: new Date('2026-05-05'), verifiedBy: adminId,
        notes: 'Transaction ID not found. Please resubmit.',
        createdAt: new Date('2026-05-04'), updatedAt: new Date(),
    });
    // Vikram: pending (hasn't paid yet)
    await db.collection('payments').insertOne({
        user: memberIds[4], group: gid1, month: 3,
        amount: 10000, status: 'pending', paymentMethod: 'upi',
        upiTransactionId: '', paidAt: null,
        verifiedAt: null, verifiedBy: null, notes: '',
        createdAt: new Date('2026-05-01'), updatedAt: new Date(),
    });
    // Anjali: pending (hasn't paid yet)
    await db.collection('payments').insertOne({
        user: memberIds[5], group: gid1, month: 3,
        amount: 10000, status: 'pending', paymentMethod: 'upi',
        upiTransactionId: '', paidAt: null,
        verifiedAt: null, verifiedBy: null, notes: '',
        createdAt: new Date('2026-05-01'), updatedAt: new Date(),
    });
    console.log('  ✅ Group 1 — Month 3: verified=1, paid=2 (awaiting), rejected=1, pending=2');

    // ── Group 2: Silver Chit — 3 members, ₹5K EMI, month 1 of 5 ─────────────
    const g2 = await db.collection('groups').insertOne({
        name: 'Silver Chit — ₹5K',
        description: '3-member group. ₹5,000 monthly EMI. POT = ₹15,000.',
        potAmount: 15000,
        emiAmount: 5000,
        reducedEmi: 4500,
        monthlyConfig: [],
        minMembers: 2,
        maxMembers: 10,
        totalMonths: 5,
        currentMonth: 1,
        dueDay: 10,
        reminderDaysBefore: 3,
        status: 'active',
        members: [memberIds[0], memberIds[2], memberIds[4]],
        createdBy: adminId,
        startDate: new Date('2026-05-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    const gid2 = g2.insertedId;

    // Group 2 — Month 1: one paid, two pending
    await db.collection('payments').insertOne({
        user: memberIds[0], group: gid2, month: 1,
        amount: 5000, status: 'paid', paymentMethod: 'cash',
        upiTransactionId: '',
        paidAt: new Date('2026-05-10'),
        verifiedAt: null, verifiedBy: null, notes: '',
        createdAt: new Date('2026-05-10'), updatedAt: new Date(),
    });
    await db.collection('payments').insertOne({
        user: memberIds[2], group: gid2, month: 1,
        amount: 5000, status: 'pending', paymentMethod: 'upi',
        upiTransactionId: '', paidAt: null,
        verifiedAt: null, verifiedBy: null, notes: '',
        createdAt: new Date('2026-05-01'), updatedAt: new Date(),
    });
    await db.collection('payments').insertOne({
        user: memberIds[4], group: gid2, month: 1,
        amount: 5000, status: 'pending', paymentMethod: 'upi',
        upiTransactionId: '', paidAt: null,
        verifiedAt: null, verifiedBy: null, notes: '',
        createdAt: new Date('2026-05-01'), updatedAt: new Date(),
    });
    console.log('  ✅ Group 2 — Month 1: paid=1 (awaiting), pending=2');

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n' + '─'.repeat(52));
    console.log('🎉 Test data seeded!');
    console.log('─'.repeat(52));
    console.log('👤 Admin   : 9876543210  | OTP = DEV_OTP');
    console.log('👥 Members : 9000000001–9000000006 | OTP = DEV_OTP | PIN = 1234');
    console.log('─'.repeat(52));
    console.log('📦 Group 1 : Gold Chit ₹10K  — 6 members, Month 3/6');
    console.log('            Month 1 & 2 fully verified (with BC draw)');
    console.log('            Month 3: ✅ verified=1 | ⏳ awaiting=2 | ❌ rejected=1 | 🔲 pending=2');
    console.log('📦 Group 2 : Silver Chit ₹5K — 3 members, Month 1/5');
    console.log('            Month 1: ⏳ awaiting=1 | 🔲 pending=2');
    console.log('─'.repeat(52));
    console.log('Test scenarios ready:');
    console.log('  • Admin: verify/reject pending payments (OTP flow)');
    console.log('  • Admin: change verified ↔ rejected (OTP flow)');
    console.log('  • Member Sneha (9000000004): sees Rejected → Resubmit');
    console.log('  • Admin: run BC draw (Month 3, eligible: Amit/Sneha/Vikram/Anjali)');
    console.log('─'.repeat(52));

    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
});
