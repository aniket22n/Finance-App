const express = require('express');
const Payment = require('../models/Payment');
const Group = require('../models/Group');
const { auth, adminOnly } = require('../middleware/auth');
const { sendPushNotification } = require('../utils/notifications');

const router = express.Router();

// POST /api/payments/initiate — Record a payment intent
router.post('/initiate', auth, async (req, res) => {
    try {
        const { groupId, month, amount, upiRef, upiTransactionId, paymentMethod, receipt } = req.body;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: 'Group not found' });

        if (!group.members.includes(req.user._id)) {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }

        // Check for existing payment
        let payment = await Payment.findOne({ user: req.user._id, group: groupId, month });
        if (payment && payment.status === 'verified') {
            return res.status(400).json({ error: 'Payment already verified for this month' });
        }

        if (payment) {
            payment.amount = amount;
            payment.upiRef = upiRef || '';
            payment.upiTransactionId = upiTransactionId || '';
            if (paymentMethod) payment.paymentMethod = paymentMethod;
            if (receipt) payment.receipt = receipt;
            payment.status = 'paid';
            payment.paidAt = new Date();
        } else {
            payment = new Payment({
                user: req.user._id,
                group: groupId,
                month,
                amount,
                upiRef: upiRef || '',
                upiTransactionId: upiTransactionId || '',
                paymentMethod: paymentMethod || 'upi',
                receipt: receipt || '',
                status: 'paid',
                paidAt: new Date(),
            });
        }

        await payment.save();
        res.json({ payment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/payments/:id/verify — Admin verifies a payment
router.put('/:id/verify', auth, adminOnly, async (req, res) => {
    try {
        const { status, notes } = req.body;
        const payment = await Payment.findById(req.params.id).populate('user', 'name phone expoPushToken');
        if (!payment) return res.status(404).json({ error: 'Payment not found' });

        payment.status = status || 'verified';
        payment.verifiedAt = new Date();
        payment.verifiedBy = req.user._id;
        if (notes) payment.notes = notes;
        await payment.save();

        // Notify user about verification
        if (payment.user.expoPushToken) {
            const title = status === 'verified' ? '✅ Payment Verified' : '❌ Payment Rejected';
            const body = status === 'verified'
                ? `Your payment of ₹${payment.amount} has been verified.`
                : `Your payment of ₹${payment.amount} was rejected. ${notes || ''}`;
            await sendPushNotification(payment.user.expoPushToken, title, body, { paymentId: payment._id });
        }

        res.json({ payment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/payments/group/:groupId — All payments for a group
router.get('/group/:groupId', auth, async (req, res) => {
    try {
        const { month, status } = req.query;
        const filter = { group: req.params.groupId };
        if (month) filter.month = parseInt(month);
        if (status) filter.status = status;

        const payments = await Payment.find(filter)
            .populate('user', 'name phone avatar')
            .populate('verifiedBy', 'name')
            .sort({ createdAt: -1 });

        res.json({ payments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/payments/user/:userId — User's payment history
router.get('/user/:userId', auth, async (req, res) => {
    try {
        // Users can only see their own payments unless admin
        if (req.user._id.toString() !== req.params.userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const payments = await Payment.find({ user: req.params.userId })
            .populate('group', 'name potAmount')
            .sort({ createdAt: -1 });

        res.json({ payments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/payments/pending — All pending payments (admin)
router.get('/pending/all', auth, adminOnly, async (req, res) => {
    try {
        const payments = await Payment.find({ status: 'paid' })
            .populate('user', 'name phone avatar')
            .populate('group', 'name')
            .sort({ paidAt: -1 });

        res.json({ payments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
