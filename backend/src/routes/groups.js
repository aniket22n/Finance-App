const express = require('express');
const Group = require('../models/Group');
const User = require('../models/User');
const { auth, adminOnly } = require('../middleware/auth');
const { validateGroupConfig, getGroupSummary } = require('../utils/emiEngine');

const router = express.Router();

// POST /api/groups — Create group (admin only)
router.post('/', auth, adminOnly, async (req, res) => {
    try {
        const { name, description, potAmount, emiAmount, reducedEmi, minMembers, maxMembers, totalMonths } = req.body;

        const config = {
            potAmount: potAmount || 0,
            emiAmount: emiAmount || 0,
            reducedEmi: reducedEmi || 0,
            minMembers: minMembers || 20,
            maxMembers: maxMembers || 100,
            totalMonths: totalMonths || minMembers || 20,
        };

        const validation = validateGroupConfig(config);
        if (!validation.valid) {
            return res.status(400).json({ error: 'Invalid config', details: validation.errors });
        }

        const group = new Group({
            name,
            description,
            ...config,
            createdBy: req.user._id,
        });

        await group.save();
        res.status(201).json({ group });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/groups — List all groups
router.get('/', auth, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (status) filter.status = status;

        // Members see only their groups, admin sees all
        if (req.user.role !== 'admin') {
            filter.members = req.user._id;
        }

        const groups = await Group.find(filter)
            .populate('members', 'name phone avatar')
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Group.countDocuments(filter);

        res.json({ groups, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/groups/:id — Get group details
router.get('/:id', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
            .populate('members', 'name phone avatar email')
            .populate('createdBy', 'name');

        if (!group) return res.status(404).json({ error: 'Group not found' });

        const summary = getGroupSummary(group);
        res.json({ group, summary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/groups/:id — Update group config (admin only)
router.put('/:id', auth, adminOnly, async (req, res) => {
    try {
        const { name, description, potAmount, emiAmount, reducedEmi, minMembers, maxMembers, totalMonths, status } = req.body;
        const updates = {};

        if (name) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (potAmount) updates.potAmount = potAmount;
        if (emiAmount) updates.emiAmount = emiAmount;
        if (reducedEmi !== undefined) updates.reducedEmi = reducedEmi;
        if (minMembers) updates.minMembers = minMembers;
        if (maxMembers) updates.maxMembers = maxMembers;
        if (totalMonths) updates.totalMonths = totalMonths;
        if (status) updates.status = status;

        const group = await Group.findByIdAndUpdate(req.params.id, updates, { new: true })
            .populate('members', 'name phone avatar');

        if (!group) return res.status(404).json({ error: 'Group not found' });
        res.json({ group });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/groups/:id/members — Add member to group
router.post('/:id/members', auth, adminOnly, async (req, res) => {
    try {
        const { userId } = req.body;
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        if (group.members.length >= group.maxMembers) {
            return res.status(400).json({ error: `Group is full (max ${group.maxMembers} members)` });
        }

        if (group.members.includes(userId)) {
            return res.status(400).json({ error: 'User is already a member' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        group.members.push(userId);
        await group.save();

        const updatedGroup = await Group.findById(group._id).populate('members', 'name phone avatar');
        res.json({ group: updatedGroup });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/groups/:id/members/:userId — Remove member
router.delete('/:id/members/:userId', auth, adminOnly, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const memberIndex = group.members.indexOf(req.params.userId);
        if (memberIndex === -1) {
            return res.status(404).json({ error: 'Member not in this group' });
        }

        group.members.splice(memberIndex, 1);
        await group.save();

        const updatedGroup = await Group.findById(group._id).populate('members', 'name phone avatar');
        res.json({ group: updatedGroup });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/groups/:id — Delete group (admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        const group = await Group.findByIdAndDelete(req.params.id);
        if (!group) return res.status(404).json({ error: 'Group not found' });
        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// PUT /api/groups/:id/monthly-config — Set per-month config (admin only)
router.put('/:id/monthly-config', auth, adminOnly, async (req, res) => {
    try {
        const { monthlyConfig } = req.body;
        // monthlyConfig = [{ month: 1, potAmount: X, emiAmount: Y, reducedEmi: Z }, ...]

        if (!Array.isArray(monthlyConfig)) {
            return res.status(400).json({ error: 'monthlyConfig must be an array' });
        }

        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        // Validate each entry
        for (const entry of monthlyConfig) {
            if (!entry.month || entry.month < 1 || entry.month > group.totalMonths) {
                return res.status(400).json({ error: `Invalid month: ${entry.month}. Must be 1-${group.totalMonths}` });
            }
            if (!entry.potAmount || !entry.emiAmount || entry.reducedEmi === undefined) {
                return res.status(400).json({ error: `Month ${entry.month}: potAmount, emiAmount, reducedEmi are all required` });
            }
        }

        group.monthlyConfig = monthlyConfig;
        await group.save();

        res.json({ group, message: 'Monthly configuration saved' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
