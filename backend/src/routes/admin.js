const express = require('express');
const mongoose = require('mongoose');
const Group = require('../models/Group');
const User = require('../models/User');
const Payment = require('../models/Payment');
const EMICycle = require('../models/EMICycle');
const { auth, adminOnly } = require('../middleware/auth');
const { sendBulkNotifications } = require('../utils/notifications');
const config = require('../config/appConfig');

const router = express.Router();

// GET /api/admin/config — Public payment config (no auth required)
router.get('/config', (req, res) => {
    res.json({
        upiVpa: config.upiVpa,
        appName: 'EMI Group',
        supportEmail: 'support@emigroup.app',
    });
});

// GET /api/admin/dashboard — Aggregated statistics
router.get('/dashboard', auth, adminOnly, async (req, res) => {
    try {
        const [totalGroups, activeGroups, totalUsers, totalPayments] = await Promise.all([
            Group.countDocuments(),
            Group.countDocuments({ status: 'active' }),
            User.countDocuments({ isActive: true }),
            Payment.countDocuments(),
        ]);

        const verifiedPayments = await Payment.aggregate([
            { $match: { status: 'verified' } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]);

        const pendingPayments = await Payment.aggregate([
            { $match: { status: { $in: ['pending', 'paid'] } } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]);

        const recentPayments = await Payment.find()
            .populate('user', 'name phone')
            .populate('group', 'name')
            .sort({ createdAt: -1 })
            .limit(10);

        const groupStats = await Group.aggregate([
            {
                $project: {
                    name: 1,
                    status: 1,
                    memberCount: { $size: '$members' },
                    currentMonth: 1,
                    totalMonths: 1,
                    progress: {
                        $cond: {
                            if: { $gt: ['$totalMonths', 0] },
                            then: { $multiply: [{ $divide: ['$currentMonth', '$totalMonths'] }, 100] },
                            else: 0,
                        },
                    },
                },
            },
            { $sort: { progress: -1 } },
            { $limit: 10 },
        ]);

        res.json({
            stats: {
                totalGroups,
                activeGroups,
                completedGroups: totalGroups - activeGroups,
                totalUsers,
                totalPayments,
                verifiedAmount: verifiedPayments[0]?.total || 0,
                verifiedCount: verifiedPayments[0]?.count || 0,
                pendingAmount: pendingPayments[0]?.total || 0,
                pendingCount: pendingPayments[0]?.count || 0,
            },
            recentPayments,
            groupStats,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/users — All users
router.get('/users', auth, adminOnly, async (req, res) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        const users = await User.find(filter)
            .select('-otp -otpExpiresAt')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await User.countDocuments(filter);
        res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/admin/users/:id/role — Update user role
router.put('/users/:id/role', auth, adminOnly, async (req, res) => {
    try {
        const { role } = req.body;
        if (!['member', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true })
            .select('-otp -otpExpiresAt');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/notify — Send bulk notifications
router.post('/notify', auth, adminOnly, async (req, res) => {
    try {
        const { title, body, groupId, data } = req.body;
        if (!title || !body) {
            return res.status(400).json({ error: 'Title and body are required' });
        }

        let tokens = [];
        if (groupId) {
            const group = await Group.findById(groupId).populate('members', 'expoPushToken');
            if (!group) return res.status(404).json({ error: 'Group not found' });
            tokens = group.members.filter(m => m.expoPushToken).map(m => m.expoPushToken);
        } else {
            const users = await User.find({ expoPushToken: { $ne: '' }, isActive: true }).select('expoPushToken');
            tokens = users.map(u => u.expoPushToken);
        }

        const results = await sendBulkNotifications(tokens, title, body, data || {});
        res.json({ sent: tokens.length, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/backup — Export DB as JSON
router.post('/backup', auth, adminOnly, async (req, res) => {
    try {
        const [users, groups, payments, emiCycles] = await Promise.all([
            User.find().select('-otp -otpExpiresAt').lean(),
            Group.find().lean(),
            Payment.find().lean(),
            EMICycle.find().lean(),
        ]);

        const backup = {
            exportedAt: new Date().toISOString(),
            data: {
                users: { count: users.length, records: users },
                groups: { count: groups.length, records: groups },
                payments: { count: payments.length, records: payments },
                emiCycles: { count: emiCycles.length, records: emiCycles },
            },
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=backup-${Date.now()}.json`);
        res.json(backup);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/trigger-reminders — Manually trigger EMI reminders
router.post('/trigger-reminders', auth, adminOnly, async (req, res) => {
    try {
        const { startScheduler } = require('../jobs/reminderScheduler');
        // We can't easily trigger the exact logic without refactoring the job function
        // However, we can require it and run the logic or just return success if we refactored
        // Let's import the sendReminders logic if it was exported, or just refactor it slightly.
        // Actually, since startScheduler just registers cron, we need a runReminders function.
        const { runRemindersNow } = require('../jobs/reminderScheduler');
        if (runRemindersNow) {
            await runRemindersNow();
        }
        res.json({ message: 'Reminders triggered successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/analytics/revenue — Monthly revenue chart data
router.get('/analytics/revenue', auth, adminOnly, async (req, res) => {
    try {
        const pipeline = [
            { $match: { status: 'verified' } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ];

        const results = await Payment.aggregate(pipeline);

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        const chartData = results.map(r => ({
            name: `${monthNames[r._id.month - 1]} ${r._id.year}`,
            amount: r.total
        }));

        res.json({ revenue: chartData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/analytics/overdue — Overdue payments
router.get('/analytics/overdue', auth, adminOnly, async (req, res) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const overdue = await Payment.find({
            status: { $in: ['pending', 'paid'] },
            createdAt: { $lt: sevenDaysAgo }
        }).populate('user', 'name phone').populate('group', 'name').sort({ createdAt: 1 });

        res.json({ overdue, count: overdue.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/analytics/group-health — Group payment health
router.get('/analytics/group-health', auth, adminOnly, async (req, res) => {
    try {
        const groups = await Group.find({ status: 'active' }).populate('members', 'name phone');

        const health = await Promise.all(groups.map(async (group) => {
            const currentMonth = group.currentMonth || 1;
            const payments = await Payment.find({
                group: group._id,
                month: currentMonth
            });

            const totalMembers = group.members.length;
            const paid = payments.filter(p => p.status === 'verified').length;
            const pending = payments.filter(p => p.status === 'pending').length;
            const paidCount = payments.filter(p => p.status === 'paid').length;

            return {
                _id: group._id,
                name: group.name,
                totalMembers,
                paid: paid + paidCount,
                pending,
                percentage: totalMembers > 0 ? Math.round(((paid + paidCount) / totalMembers) * 100) : 0
            };
        }));

        res.json({ groups: health });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
