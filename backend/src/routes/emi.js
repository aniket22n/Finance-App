const express = require('express');
const EMICycle = require('../models/EMICycle');
const Group = require('../models/Group');
const Payment = require('../models/Payment');
const { auth, adminOnly } = require('../middleware/auth');
const { calculateMonthlyDues, calculatePotTotal } = require('../utils/emiEngine');
const { sendPushNotification, sendBulkNotifications } = require('../utils/notifications');

const router = express.Router();

// POST /api/emi/cycle — Create next EMI cycle (admin only)
router.post('/cycle', auth, adminOnly, async (req, res) => {
    try {
        const { groupId, winnerId } = req.body;

        const group = await Group.findById(groupId).populate('members', 'name phone expoPushToken');
        if (!group) return res.status(404).json({ error: 'Group not found' });

        if (group.status !== 'active') {
            return res.status(400).json({ error: 'Group is not active' });
        }

        if (!group.members.find(m => m._id.toString() === winnerId)) {
            return res.status(400).json({ error: 'Winner must be a group member' });
        }

        const nextMonth = group.currentMonth + 1;
        if (nextMonth > group.totalMonths) {
            return res.status(400).json({ error: 'All cycles completed for this group' });
        }

        // Check if winner already won in a previous cycle
        const previousCycles = await EMICycle.find({ group: groupId });
        const pastWinnerIds = previousCycles.map(c => c.winner.toString());

        if (pastWinnerIds.includes(winnerId)) {
            return res.status(400).json({ error: 'This member has already won the pot' });
        }

        const cycle = new EMICycle({
            group: groupId,
            month: nextMonth,
            winner: winnerId,
            emiAmount: group.emiAmount,
            reducedEmi: group.reducedEmi,
            potAmount: group.potAmount,
        });

        await cycle.save();

        // Update group current month
        group.currentMonth = nextMonth;
        if (nextMonth >= group.totalMonths) {
            group.status = 'completed';
        }
        await group.save();

        // Create pending payment records for all members
        const dues = calculateMonthlyDues(group, winnerId);
        for (const due of dues) {
            await Payment.findOneAndUpdate(
                { user: due.userId, group: groupId, month: nextMonth },
                {
                    user: due.userId,
                    group: groupId,
                    month: nextMonth,
                    amount: due.amount,
                    status: 'pending',
                },
                { upsert: true, new: true }
            );
        }

        // Send notifications
        const winnerMember = group.members.find(m => m._id.toString() === winnerId);
        if (winnerMember && winnerMember.expoPushToken) {
            await sendPushNotification(
                winnerMember.expoPushToken,
                '🎉 Congratulations! You won the pot!',
                `You are the pot holder for Month ${nextMonth}. Your EMI is reduced to ₹${group.reducedEmi}.`,
                { type: 'pot_winner', groupId, month: nextMonth }
            );
        }

        // Notify all other members
        const otherTokens = group.members
            .filter(m => m._id.toString() !== winnerId && m.expoPushToken)
            .map(m => m.expoPushToken);

        if (otherTokens.length > 0) {
            await sendBulkNotifications(
                otherTokens,
                `📢 Month ${nextMonth} EMI Due`,
                `EMI of ₹${group.emiAmount} is due for ${group.name}. Pay before the deadline.`,
                { type: 'emi_due', groupId, month: nextMonth }
            );
        }

        // Notify next eligible members
        const nextEligibleTokens = group.members
            .filter(m => m._id.toString() !== winnerId && !pastWinnerIds.includes(m._id.toString()) && m.expoPushToken)
            .map(m => m.expoPushToken);

        if (nextEligibleTokens.length > 0) {
            await sendBulkNotifications(
                nextEligibleTokens,
                `🎰 Next Draw Coming Soon!`,
                `You are eligible for the next pot draw in ${group.name}! ${nextEligibleTokens.length} members remaining.`,
                { type: 'next_draw', groupId }
            );
        }

        res.status(201).json({ cycle, dues });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/emi/group/:groupId — Get all cycles for a group
router.get('/group/:groupId', auth, async (req, res) => {
    try {
        const cycles = await EMICycle.find({ group: req.params.groupId })
            .populate('winner', 'name phone avatar')
            .sort({ month: 1 });

        res.json({ cycles });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/emi/current/:groupId — Get current month's cycle
router.get('/current/:groupId', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const cycle = await EMICycle.findOne({ group: req.params.groupId, month: group.currentMonth })
            .populate('winner', 'name phone avatar');

        if (!cycle) return res.status(404).json({ error: 'No active cycle found' });

        const potTotal = calculatePotTotal(group);
        res.json({ cycle, potTotal });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/emi/eligible/:groupId — Get members eligible for the next draw
router.get('/eligible/:groupId', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId).populate('members', 'name phone avatar');
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const cycles = await EMICycle.find({ group: req.params.groupId });
        const pastWinnerIds = cycles.map(c => c.winner.toString());

        const eligibleMembers = group.members.filter(m => !pastWinnerIds.includes(m._id.toString()));

        res.json({ count: eligibleMembers.length, members: eligibleMembers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
