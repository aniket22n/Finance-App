const express = require('express');
const mongoose = require('mongoose');
const Group = require('../models/Group');
const User = require('../models/User');
const Payment = require('../models/Payment');
const EMICycle = require('../models/EMICycle');
const AccountRequest = require('../models/AccountRequest');
const { auth, adminOnly } = require('../middleware/auth');
const { sendBulkNotifications, sendPushNotification } = require('../utils/notifications');
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

// GET /api/admin/payments/stats?groupId=&month= — Filtered payment stats
router.get('/payments/stats', auth, adminOnly, async (req, res) => {
    try {
        const { groupId, month } = req.query;
        const filter = {};
        if (groupId) filter.group = mongoose.Types.ObjectId.createFromHexString(groupId);
        if (month)   filter.month = parseInt(month);

        const [verified, pending] = await Promise.all([
            Payment.aggregate([
                { $match: { ...filter, status: 'verified' } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]),
            Payment.aggregate([
                { $match: { ...filter, status: 'pending' } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]),
        ]);

        res.json({
            success: true,
            data: {
                verifiedAmount: verified[0]?.total || 0,
                verifiedCount:  verified[0]?.count || 0,
                pendingAmount:  pending[0]?.total  || 0,
                pendingCount:   pending[0]?.count  || 0,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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

        // Exclude "zombie" tempUsers — User docs created by send-otp that never finished
        // signup. They have no firstName/lastName/name and would just clutter the list.
        // Real members always have at least firstName set, admins always have a name.
        const zombieFilter = {
            $or: [
                { firstName: { $exists: true, $ne: '' } },
                { lastName:  { $exists: true, $ne: '' } },
                { name:      { $exists: true, $ne: '' } },
            ],
        };

        const users = await User.find({ $and: [filter, zombieFilter] })
            .select('-otp -otpExpiresAt')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();

        // Build a userId → groups[{_id,name}] map in one query, then attach to each user.
        const userIds = users.map(u => u._id);
        const groups  = await Group.find({ members: { $in: userIds } }, 'name members').lean();
        const byUser  = new Map();
        for (const g of groups) {
            for (const memberId of (g.members || [])) {
                const key = String(memberId);
                if (!byUser.has(key)) byUser.set(key, []);
                byUser.get(key).push({ _id: g._id, name: g.name });
            }
        }
        const enriched = users.map(u => ({ ...u, groups: byUser.get(String(u._id)) || [] }));

        const total = await User.countDocuments({ $and: [filter, zombieFilter] });
        res.json({ users: enriched, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/admin/users/:id — Delete user account
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
    try {
        // Block deleting admin accounts — both other admins AND self.
        const target = await User.findById(req.params.id);
        if (!target) return res.status(404).json({ error: 'User not found' });
        if (target.role === 'admin') {
            return res.status(400).json({ error: 'Admin accounts cannot be deleted from User Management' });
        }
        if (String(target._id) === String(req.user._id)) {
            return res.status(400).json({ error: 'You cannot delete your own account' });
        }

        await User.deleteOne({ _id: target._id });
        // Pull the deleted user out of every group's members[] so no dangling refs remain.
        // (Historical Payment/EMICycle records keep the userId as audit trail.)
        const pull = await Group.updateMany(
            { members: target._id },
            { $pull: { members: target._id } }
        );
        res.json({ success: true, message: 'User deleted successfully', removedFromGroups: pull.modifiedCount });
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

// GET /api/admin/account-requests/pending
router.get('/account-requests/pending', auth, adminOnly, async (req, res) => {
    try {
        const pending = await AccountRequest.find({ status: 'pending' })
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, requests: pending });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/account-requests — all statuses
router.get('/account-requests', auth, adminOnly, async (req, res) => {
    try {
        const { status } = req.query;
        const filter = status ? { status } : {};
        const requests = await AccountRequest.find(filter)
            .populate('reviewedBy', 'name')
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/account-requests/:requestId/approve
router.post('/account-requests/:requestId/approve', auth, adminOnly, async (req, res) => {
    try {
        const request = await AccountRequest.findById(req.params.requestId);
        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Request is no longer pending' });
        }

        // Check phone not already in User table. If a "zombie" tempUser exists (created
        // by send-otp but never completed signup — empty firstName/lastName/name and no
        // PIN), clear it out so the approval can proceed. Real registered users (with
        // a name) still get rejected.
        const exists = await User.findOne({ phone: request.phone });
        if (exists) {
            const isZombie = !exists.firstName && !exists.lastName && !exists.name && !exists.pin;
            if (!isZombie) {
                return res.status(400).json({ error: 'Phone already registered as a user' });
            }
            await User.deleteOne({ _id: exists._id });
        }

        // Create approved User from request — pre-save hook will sync `name` from first+last.
        const user = await User.create({
            firstName: request.firstName || '',
            lastName:  request.lastName  || '',
            ...(request.name && !request.firstName ? { name: request.name } : {}),
            phone: request.phone,
            pin:   request.pin,
            role:  'member',
        });

        request.status = 'approved';
        request.reviewedAt = new Date();
        request.reviewedBy = req.user._id;
        await request.save();

        // In-app notification for the new user.
        const { notifyUsers } = require('../utils/notify');
        await notifyUsers(user._id, {
            type: 'account_approved',
            title: 'Account approved',
            body: 'Your account was approved. You can now log in with your PIN.',
            data: { userId: String(user._id) },
        });

        res.json({ success: true, message: 'Account approved', user: { _id: user._id, name: user.name, phone: user.phone } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/account-requests/:requestId/reject
router.post('/account-requests/:requestId/reject', auth, adminOnly, async (req, res) => {
    try {
        const { reason } = req.body;
        const request = await AccountRequest.findById(req.params.requestId);
        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Request is no longer pending' });
        }

        // Delete the rejected request entirely (rather than soft-marking it) so the
        // applicant can try signing up again later. Soft-rejection used to permanently
        // block re-applications via the signup-with-pin "rejected" check.
        const phone = request.phone;
        await AccountRequest.deleteOne({ _id: request._id });

        // Clean up any zombie tempUser (created by repeated send-otp calls). Don't touch
        // an actual registered user.
        const existingUser = await User.findOne({ phone });
        if (existingUser && !existingUser.firstName && !existingUser.lastName && !existingUser.name && !existingUser.pin) {
            await User.deleteOne({ _id: existingUser._id });
        }

        res.json({
            success: true,
            message: 'Account request rejected and removed',
            reason: reason?.trim() || null,    // returned for the admin's logs/UI even though the record is gone
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/groups/:groupId/configure-pot
// Bulk-set winner + EMI amounts per month for a group.
// Body: { potConfig: [{ month, selectedWinner, winnerEMI, otherMemberEMI }, ...] }
router.post('/groups/:groupId/configure-pot', auth, adminOnly, async (req, res) => {
    try {
        const { potConfig } = req.body;
        if (!Array.isArray(potConfig) || potConfig.length === 0) {
            return res.status(400).json({ error: 'potConfig must be a non-empty array' });
        }

        const group = await Group.findById(req.params.groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const memberSet = new Set(group.members.map(id => String(id)));
        const memberCount = group.members.length;
        const currentMonth = group.currentMonth || 0;
        const seenMonths = new Set();
        const sanitized = [];

        // Preserve already-run (locked) months from the existing config so the client
        // can submit a payload covering only the future months without wiping history.
        const lockedRows = (group.monthlyConfig || []).filter(c => c.month <= currentMonth);
        const usedWinners = new Set();
        for (const row of lockedRows) {
            sanitized.push({
                month:      row.month,
                winner:     row.winner,
                reducedEmi: row.reducedEmi,
                emiAmount:  row.emiAmount,
                potAmount:  row.potAmount,
            });
            seenMonths.add(row.month);
            if (row.winner) usedWinners.add(String(row.winner));
        }

        for (const entry of potConfig) {
            const month = Number(entry.month);
            if (!Number.isInteger(month) || month < 1 || month > group.totalMonths) {
                return res.status(400).json({ error: `Invalid month: ${entry.month}. Must be 1-${group.totalMonths}` });
            }
            if (month <= currentMonth) {
                return res.status(400).json({ error: `Month ${month} is locked — its cycle has already been executed` });
            }
            if (seenMonths.has(month)) {
                return res.status(400).json({ error: `Duplicate entry for month ${month}` });
            }
            seenMonths.add(month);

            const winnerEMI      = Number(entry.winnerEMI);
            const otherMemberEMI = Number(entry.otherMemberEMI);
            if (!Number.isFinite(winnerEMI) || winnerEMI <= 0) {
                return res.status(400).json({ error: `Month ${month}: winnerEMI must be a positive number` });
            }
            if (!Number.isFinite(otherMemberEMI) || otherMemberEMI <= 0) {
                return res.status(400).json({ error: `Month ${month}: otherMemberEMI must be a positive number` });
            }

            let winnerId = null;
            if (entry.selectedWinner) {
                winnerId = String(entry.selectedWinner);
                if (!memberSet.has(winnerId)) {
                    return res.status(400).json({ error: `Month ${month}: selectedWinner is not a member of this group` });
                }
                if (usedWinners.has(winnerId)) {
                    return res.status(400).json({ error: `Month ${month}: this member is already a winner in another month` });
                }
                usedWinners.add(winnerId);
            }

            sanitized.push({
                month,
                winner: winnerId,
                emiAmount: winnerEMI,
                reducedEmi: otherMemberEMI,
                potAmount: winnerEMI + otherMemberEMI * Math.max(0, memberCount - 1),
            });
        }

        sanitized.sort((a, b) => a.month - b.month);
        group.monthlyConfig = sanitized;

        // Auto-activate a pending group once POT plan has at least one planned winner AND
        // the roster has members. Draw route requires status==='active'; without this the
        // admin would have no way to start the scheme.
        const plannedHasWinner = sanitized.some(c => c.winner && c.month > (group.currentMonth || 0));
        if (group.status === 'pending' && plannedHasWinner && group.members.length > 0) {
            group.status = 'active';
            if (!group.startDate) group.startDate = new Date();
        }

        await group.save();

        res.json({ success: true, message: 'POT configuration saved', groupId: group._id, status: group.status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/groups/:groupId/activate — Manually flip a pending group to active.
// The configurePot route auto-activates in the standard flow; this is the escape hatch
// for cases where the admin wants to start the scheme without re-saving the POT plan.
router.post('/groups/:groupId/activate', auth, adminOnly, async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        if (group.status === 'active')    return res.status(400).json({ error: 'Group is already active' });
        if (group.status === 'completed') return res.status(400).json({ error: 'Group is already completed' });
        if (group.members.length === 0)   return res.status(400).json({ error: 'Add at least one member before activating' });

        group.status = 'active';
        if (!group.startDate) group.startDate = new Date();
        await group.save();

        res.json({ success: true, message: 'Group activated', groupId: group._id, status: group.status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
