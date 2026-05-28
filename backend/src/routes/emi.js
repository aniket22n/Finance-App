const express = require('express');
const EMICycle = require('../models/EMICycle');
const Group = require('../models/Group');
const Payment = require('../models/Payment');
const { auth, adminOnly } = require('../middleware/auth');
const { calculateMonthlyDues, calculatePotTotal } = require('../utils/emiEngine');
const { sendPushNotification, sendBulkNotifications } = require('../utils/notifications');
const { notifyUsers } = require('../utils/notify');
const { validate, createCycleValidations } = require('../middleware/validators');

const router = express.Router();
const validateObjectId = require('../middleware/validateObjectId');
router.param('groupId', validateObjectId);

// POST /api/emi/cycle — Create next EMI cycle (admin only)
// Integrates with group.monthlyConfig (POT Plan):
//  - If the next month has a planned winner, that plan's amounts are used.
//  - Body's winnerId may override the planned winner; the plan is updated to match (truth wins).
//  - If no plan exists for the month, this back-fills it so the table reflects history.
router.post('/cycle', auth, adminOnly, createCycleValidations, validate, async (req, res) => {
    try {
        const { groupId, winnerId, reducedEmi: bodyReducedEmi, emiAmount: bodyEmiAmount } = req.body;

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

        // ── Reconcile with POT Plan ─────────────────────────────────────
        // Find this month's planned config (if any). If a different month already plans this same
        // winner, reject — each member can win only once.
        const plannedIdx = group.monthlyConfig.findIndex(c => c.month === nextMonth);
        const planned    = plannedIdx >= 0 ? group.monthlyConfig[plannedIdx] : null;
        const conflict   = group.monthlyConfig.find(c =>
            c.month !== nextMonth && c.winner && c.winner.toString() === winnerId
        );
        if (conflict) {
            return res.status(400).json({
                error: `This member is already planned to win month ${conflict.month}. Update the POT plan first.`,
            });
        }

        // Decide amounts: caller-provided override (admin edited at draw time) wins; else
        // fall back to planned value, then to group default.
        const overrideReduced = Number(bodyReducedEmi);
        const overrideEmi     = Number(bodyEmiAmount);
        const monthEmi     = Number.isFinite(overrideEmi)     && overrideEmi     > 0 ? overrideEmi     : (planned?.emiAmount  ?? group.emiAmount);
        const monthReduced = Number.isFinite(overrideReduced) && overrideReduced > 0 ? overrideReduced : (planned?.reducedEmi ?? group.reducedEmi);
        const monthPot     = planned?.potAmount  ?? group.potAmount;

        const cycle = new EMICycle({
            group: groupId,
            month: nextMonth,
            winner: winnerId,
            emiAmount:  monthEmi,
            reducedEmi: monthReduced,
            potAmount:  monthPot,
        });

        await cycle.save();

        // Back-fill / update monthlyConfig so the POT Plan table stays truthful
        const entry = {
            month: nextMonth,
            winner: winnerId,
            reducedEmi: monthReduced,
            emiAmount:  monthEmi,
            potAmount:  monthPot,
        };
        if (plannedIdx >= 0) group.monthlyConfig[plannedIdx] = entry;
        else                 group.monthlyConfig.push(entry);

        // Update group current month
        group.currentMonth = nextMonth;
        if (nextMonth >= group.totalMonths) {
            group.status = 'completed';
        }
        await group.save();

        // Create pending payment records for all members using per-month amounts.
        // pastWinnerIds ensures prior winners also pay emiAmount, not reducedEmi.
        const dues = calculateMonthlyDues(group, winnerId, monthEmi, monthReduced, pastWinnerIds);
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
        const allMemberIds  = group.members.map(m => m._id);
        const otherMemberIds = group.members.filter(m => m._id.toString() !== winnerId).map(m => m._id);
        const winnerMember  = group.members.find(m => m._id.toString() === winnerId);
        const winnerName    = winnerMember?.name || 'A member';

        // Push: winner
        if (winnerMember?.expoPushToken) {
            sendPushNotification(
                winnerMember.expoPushToken,
                'Congratulations! You won the pot!',
                `You are the pot holder for Month ${nextMonth} in ${group.name}. Your EMI is ₹${monthEmi}.`,
                { type: 'pot_winner', groupId, month: nextMonth }
            ).catch(() => {});
        }

        // Push: other members
        const otherTokens = group.members
            .filter(m => m._id.toString() !== winnerId && m.expoPushToken)
            .map(m => m.expoPushToken);
        if (otherTokens.length > 0) {
            sendBulkNotifications(
                otherTokens,
                `Pot Draw — Month ${nextMonth}`,
                `${winnerName} won the pot in ${group.name}. Month ${nextMonth} EMI of ₹${monthReduced} is now due.`,
                { type: 'pot_draw', groupId, month: nextMonth }
            ).catch(() => {});
        }

        // Bell (in-app): winner
        notifyUsers([winnerMember._id], {
            type: 'pot_winner',
            title: 'You won the pot!',
            body: `Congratulations! You are the pot holder for Month ${nextMonth} in ${group.name}. Your EMI is ₹${monthEmi}.`,
            data: { groupId: String(groupId), month: nextMonth },
        });

        // Bell (in-app): all other members
        notifyUsers(otherMemberIds, {
            type: 'pot_draw',
            title: `Pot Draw — Month ${nextMonth}`,
            body: `${winnerName} won the pot in ${group.name}. Your EMI of ₹${monthReduced} is now due.`,
            data: { groupId: String(groupId), month: nextMonth },
        });

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

// GET /api/emi/planned-winner/:groupId — The POT-Plan winner for the next month (if any)
router.get('/planned-winner/:groupId', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.groupId).lean();
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const nextMonth = (group.currentMonth || 0) + 1;
        const entry = (group.monthlyConfig || []).find(c => c.month === nextMonth);
        res.json({
            nextMonth,
            totalMonths: group.totalMonths,
            plannedWinnerId: entry?.winner || null,
            plannedEmiAmount:  entry?.emiAmount  ?? null,
            plannedReducedEmi: entry?.reducedEmi ?? null,
        });
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
