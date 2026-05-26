const express = require('express');
const Payment = require('../models/Payment');
const Group = require('../models/Group');
const User = require('../models/User');
const { auth, adminOnly } = require('../middleware/auth');
const { sendPushNotification } = require('../utils/notifications');
const { validate, initiatePaymentValidations } = require('../middleware/validators');
const config = require('../config/appConfig');

const sendAdminActionOtp = async (admin) => {
    const otp = config.devOtp || Math.floor(1000 + Math.random() * 9000).toString();
    admin.otp = otp;
    admin.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await admin.save();
    if (process.env.FAST2SMS_API_KEY) {
        const axios = require('axios');
        try {
            await axios({
                method: 'POST',
                url: 'https://www.fast2sms.com/dev/bulkV2',
                headers: { authorization: process.env.FAST2SMS_API_KEY, 'Content-Type': 'application/json' },
                data: { variables_values: otp, route: 'otp', numbers: admin.phone },
            });
        } catch (e) {
            console.error('SMS OTP failed:', e.message);
        }
    } else {
        console.log(`📱 (DEV) Admin action OTP for ${admin.phone}: ${otp}`);
    }
};

const verifyAdminOtp = (admin, otp) => {
    const validOtp = admin.otp === otp && admin.otpExpiresAt > new Date();
    const devMode = config.devOtp && otp === config.devOtp;
    return validOtp || devMode;
};

const router = express.Router();

// POST /api/payments/initiate — Record a payment intent
router.post('/initiate', auth, initiatePaymentValidations, validate, async (req, res) => {
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

        // Notify all admins so the bell badge increments on the dashboard.
        const { notifyAllAdmins } = require('../utils/notify');
        await notifyAllAdmins({
            type: 'payment_submitted',
            title: 'New Payment Submitted',
            body: `${req.user.name || req.user.phone} paid ₹${amount.toLocaleString('en-IN')} for ${group.name} · Month ${month}`,
            data: { paymentId: String(payment._id), groupId: String(groupId), month },
        });

        res.json({ payment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/payments/:id/request-action-otp — Admin requests OTP to change payment status
router.post('/:id/request-action-otp', auth, adminOnly, async (req, res) => {
    try {
        const admin = await User.findById(req.user._id);
        if (!admin) return res.status(404).json({ error: 'Admin not found' });
        await sendAdminActionOtp(admin);
        res.json({ success: true, message: 'OTP sent to your registered phone' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/payments/:id/verify — Admin changes payment status (requires OTP)
router.put('/:id/verify', auth, adminOnly, async (req, res) => {
    try {
        const { status, notes, otp } = req.body;

        if (!otp) return res.status(400).json({ error: 'OTP is required to change payment status' });
        const admin = await User.findById(req.user._id);
        if (!verifyAdminOtp(admin, otp)) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }
        admin.otp = undefined;
        admin.otpExpiresAt = undefined;
        await admin.save();

        const newStatus = status || 'verified';
        const payment = await Payment.findById(req.params.id).populate('user', 'name phone expoPushToken');
        if (!payment) return res.status(404).json({ error: 'Payment not found' });

        payment.status = newStatus;
        payment.verifiedAt = new Date();
        payment.verifiedBy = req.user._id;
        if (notes) payment.notes = notes;
        await payment.save();

        // Notify member
        const { notifyUsers } = require('../utils/notify');
        let title, body, notifType;
        if (newStatus === 'verified') {
            title = '✅ Payment Verified';
            body = `Your payment of ₹${payment.amount.toLocaleString('en-IN')} has been verified.`;
            notifType = 'payment_verified';
        } else if (newStatus === 'failed') {
            title = '❌ Payment Rejected';
            body = `Your payment of ₹${payment.amount.toLocaleString('en-IN')} was rejected. Please resubmit your payment.${notes ? ' ' + notes : ''}`;
            notifType = 'payment_rejected';
        } else {
            title = '🔄 Payment Reset';
            body = `Your payment of ₹${payment.amount.toLocaleString('en-IN')} has been reset to ${newStatus}.`;
            notifType = 'payment_updated';
        }
        if (payment.user.expoPushToken) {
            sendPushNotification(payment.user.expoPushToken, title, body, { paymentId: String(payment._id) }).catch(() => {});
        }
        await notifyUsers(payment.user._id, {
            type: notifType,
            title,
            body,
            data: { paymentId: String(payment._id) },
        });

        res.json({ success: true, payment });
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

// GET /api/payments/admin/list — All payments with optional status filter (admin)
router.get('/admin/list', auth, adminOnly, async (req, res) => {
    try {
        const { status, limit = 100 } = req.query;
        const filter = {};
        if (status) filter.status = status;

        const payments = await Payment.find(filter)
            .populate('user', 'name phone avatar')
            .populate('group', 'name')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

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

// POST /api/payments/:id/remind — Admin sends a payment reminder to a member
router.post('/:id/remind', auth, adminOnly, async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate('user', 'name phone expoPushToken')
            .populate('group', 'name');
        if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

        const allowedStatuses = ['pending', 'rejected', 'failed'];
        if (!allowedStatuses.includes(payment.status)) {
            return res.status(400).json({ success: false, message: 'Reminder can only be sent for pending or rejected payments' });
        }

        const memberName = payment.user?.name || payment.user?.phone || 'Member';
        const groupName  = payment.group?.name || 'your group';
        const amount     = payment.amount?.toLocaleString('en-IN') || '';

        const title = '⏰ Payment Reminder';
        const body  = payment.status === 'rejected'
            ? `Your payment of ₹${amount} for ${groupName} Month ${payment.month} was rejected. Please resubmit.`
            : `Your EMI of ₹${amount} for ${groupName} Month ${payment.month} is due. Please pay now.`;

        if (payment.user?.expoPushToken) {
            sendPushNotification(payment.user.expoPushToken, title, body, {
                paymentId: String(payment._id),
                screen: 'Payments',
            }).catch(() => {});
        }

        const { notifyUsers } = require('../utils/notify');
        await notifyUsers(payment.user._id, {
            type: 'payment_reminder',
            title,
            body,
            data: { paymentId: String(payment._id) },
        });

        res.json({ success: true, message: `Reminder sent to ${memberName}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/payments/my/pending — Current user's pending payments
router.get('/my/pending', auth, async (req, res) => {
    try {
        const payments = await Payment.find({ user: req.user._id, status: 'pending' })
            .populate('group', 'name emiAmount reducedEmiAmount potAmount dueDate')
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, data: { payments } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
