const express = require('express');
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();
router.param('id', validateObjectId);

// GET /api/notifications — list current user's notifications (newest first, capped 50)
router.get('/', auth, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const items = await Notification.find({ recipient: req.user._id })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        res.json({ notifications: items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/notifications/unread-count — quick badge poll
router.get('/unread-count', auth, async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            recipient: req.user._id,
            read: false,
        });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/notifications/:id/read — mark single notification as read
router.patch('/:id/read', auth, async (req, res) => {
    try {
        const n = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user._id },   // owner-scoped — can only mark own
            { read: true },
            { new: true }
        );
        if (!n) return res.status(404).json({ error: 'Notification not found' });
        res.json({ notification: n });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/notifications/read-all — mark every unread notification as read
router.patch('/read-all', auth, async (req, res) => {
    try {
        const result = await Notification.updateMany(
            { recipient: req.user._id, read: false },
            { read: true }
        );
        res.json({ success: true, marked: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/notifications/:id — dismiss a single notification (swipe-to-clear)
router.delete('/:id', auth, async (req, res) => {
    try {
        const result = await Notification.deleteOne({
            _id: req.params.id,
            recipient: req.user._id,    // owner-scoped — can only delete own
        });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
