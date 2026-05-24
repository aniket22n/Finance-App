const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AccountRequest = require('../models/AccountRequest');
const { auth } = require('../middleware/auth');
const config = require('../config/appConfig');
const {
    validate,
    sendOtpValidations,
    verifyOtpValidations,
    loginPasswordValidations,
    signupValidations,
    resetPasswordValidations,
    checkUserTypeValidations,
    loginWithPinValidations,
    signupWithPinValidations,
    setPinValidations,
    resetPinValidations,
} = require('../middleware/validators');

const issueToken = (user) => jwt.sign(
    { userId: user._id, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiry }
);

const userResponse = (user) => ({
    _id: user._id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
});

const sendOtpToUser = async (user, phone) => {
    const otp = config.devOtp || Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    if (process.env.FAST2SMS_API_KEY) {
        const axios = require('axios');
        try {
            await axios({
                method: 'POST',
                url: 'https://www.fast2sms.com/dev/bulkV2',
                headers: {
                    'authorization': process.env.FAST2SMS_API_KEY,
                    'Content-Type': 'application/json',
                },
                data: { variables_values: otp, route: 'otp', numbers: phone },
            });
            console.log(`✉️ SMS OTP sent to ${phone}`);
        } catch (err) {
            console.error(`❌ Failed to send SMS to ${phone}:`, err.response?.data || err.message);
        }
    } else {
        console.log(`📱 (DEV) OTP for ${phone}: ${otp}`);
    }
};

const verifyOtpMatch = (user, otp) => {
    const validOtp = user.otp === otp && user.otpExpiresAt > new Date();
    const devMode = config.devOtp && otp === config.devOtp;
    return validOtp || devMode;
};

const router = express.Router();

// ─── Rate Limiting (Simple in-memory) ───
// Limits: 5 OTP requests per phone per 1 hour
const otpRateLimit = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const checkRateLimit = (phone) => {
    const now = Date.now();
    const record = otpRateLimit.get(phone) || { count: 0, windowStart: now };

    // Reset if window expired
    if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
        record.count = 1;
        record.windowStart = now;
        otpRateLimit.set(phone, record);
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }

    // Check if exceeded
    if (record.count >= RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0, retryAfter: Math.ceil((record.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000) };
    }

    record.count++;
    otpRateLimit.set(phone, record);
    return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
};

// Cleanup old entries every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [phone, record] of otpRateLimit.entries()) {
        if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
            otpRateLimit.delete(phone);
        }
    }
}, 10 * 60 * 1000);

// GET /api/auth/check-phone?phone=XXXXXXXXXX
// Returns { exists, pendingRequest } so the mobile can show the right message early
router.get('/check-phone', async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone || !/^\d{10}$/.test(phone)) {
            return res.status(400).json({ error: 'Valid 10-digit phone number required' });
        }
        const [user, request] = await Promise.all([
            User.findOne({ phone, name: { $exists: true, $ne: '' } }).lean(),
            AccountRequest.findOne({ phone }).lean(),
        ]);
        res.json({
            exists: !!user,
            pendingRequest: request?.status === 'pending',
            rejectedRequest: request?.status === 'rejected',
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/send-otp
router.post('/send-otp', sendOtpValidations, validate, async (req, res) => {
    try {
        const { phone } = req.body;

        // Rate limiting check
        const rateCheck = checkRateLimit(phone);
        if (!rateCheck.allowed) {
            return res.status(429).json({
                error: 'Too many OTP requests',
                message: `Maximum ${RATE_LIMIT_MAX} OTPs per hour. Try again in ${rateCheck.retryAfter} seconds.`,
            });
        }
        console.log(`📱 OTP rate limit for ${phone}: ${rateCheck.remaining} remaining`);

        let user = await User.findOne({ phone });
        if (!user) {
            user = new User({ phone });
        }

        // Generate OTP (use DEV_OTP in development)
        const otp = config.devOtp || Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await user.save();

        // In production, send OTP via Fast2SMS
        if (process.env.FAST2SMS_API_KEY) {
            const axios = require('axios');
            const options = {
                method: 'POST',
                url: 'https://www.fast2sms.com/dev/bulkV2',
                headers: {
                    'authorization': process.env.FAST2SMS_API_KEY,
                    'Content-Type': 'application/json'
                },
                data: {
                    variables_values: otp,
                    route: 'otp',
                    numbers: phone,
                }
            };
            try {
                await axios(options);
                console.log(`✉️ SMS OTP sent to ${phone}`);
            } catch (smsError) {
                console.error(`❌ Failed to send SMS to ${phone}:`, smsError.response?.data || smsError.message);
                // Optionally throw an error here, but for now we continue
            }
        } else {
            console.log(`📱 (DEV) OTP for ${phone}: ${otp}`);
        }

        res.json({ message: 'OTP sent successfully', phone });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', verifyOtpValidations, validate, async (req, res) => {
    try {
        const { phone, otp } = req.body;

        const user = await User.findOne({ phone });
        if (!user) {
            // No User at all — check AccountRequest for a helpful error
            const request = await AccountRequest.findOne({ phone });
            if (request?.status === 'pending') {
                return res.status(403).json({ error: 'Account pending approval. Admin will review your request shortly.' });
            }
            if (request?.status === 'rejected') {
                return res.status(403).json({ error: 'Account request rejected. Please contact admin for assistance.' });
            }
            return res.status(404).json({ error: 'No account found. Please sign up first.' });
        }

        // Check OTP
        const validOtp = user.otp === otp && user.otpExpiresAt > new Date();
        const devMode = config.devOtp && otp === config.devOtp;

        if (!validOtp && !devMode) {
            return res.status(401).json({ error: 'Invalid or expired OTP' });
        }

        // Temp users (created by send-otp, no name yet) are not registered accounts
        if (!user.name) {
            const request = await AccountRequest.findOne({ phone });
            if (request?.status === 'pending') {
                return res.status(403).json({ error: 'Account pending approval. Admin will review your request shortly.' });
            }
            if (request?.status === 'rejected') {
                return res.status(403).json({ error: 'Account request rejected. Please contact admin for assistance.' });
            }
            return res.status(404).json({ error: 'No account found. Please sign up first.' });
        }

        // Clear OTP
        user.otp = '';
        user.otpExpiresAt = undefined;
        await user.save();

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            config.jwtSecret,
            { expiresIn: config.jwtExpiry }
        );

        res.json({
            token,
            user: {
                _id: user._id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
            },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/login (phone + password)
router.post('/login', loginPasswordValidations, validate, async (req, res) => {
    try {
        const { phone, password } = req.body;
        const user = await User.findOne({ phone });
        if (!user || !user.hasPassword()) {
            return res.status(401).json({ error: 'Invalid phone or password' });
        }
        const ok = await user.comparePassword(password);
        if (!ok) return res.status(401).json({ error: 'Invalid phone or password' });

        res.json({ token: issueToken(user), user: userResponse(user) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/signup (phone + otp + password + name)
router.post('/signup', signupValidations, validate, async (req, res) => {
    try {
        const { phone, otp, password, name } = req.body;
        const user = await User.findOne({ phone });
        if (!user) return res.status(404).json({ error: 'No OTP request found for this phone' });

        if (!verifyOtpMatch(user, otp)) {
            return res.status(401).json({ error: 'Invalid or expired OTP' });
        }

        user.name = name.trim();
        await user.setPassword(password);
        user.otp = '';
        user.otpExpiresAt = undefined;
        await user.save();

        res.json({ token: issueToken(user), user: userResponse(user) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/forgot-password (phone → send OTP)
router.post('/forgot-password', sendOtpValidations, validate, async (req, res) => {
    try {
        const { phone } = req.body;

        const rateCheck = checkRateLimit(phone);
        if (!rateCheck.allowed) {
            return res.status(429).json({
                error: 'Too many OTP requests',
                message: `Maximum ${RATE_LIMIT_MAX} OTPs per hour. Try again in ${rateCheck.retryAfter} seconds.`,
            });
        }

        const user = await User.findOne({ phone });
        if (!user || !user.hasPassword()) {
            // Don't leak whether account exists — respond OK either way
            return res.json({ message: 'If an account exists, an OTP has been sent', phone });
        }

        await sendOtpToUser(user, phone);
        res.json({ message: 'OTP sent successfully', phone });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/reset-password (phone + otp + newPassword)
router.post('/reset-password', resetPasswordValidations, validate, async (req, res) => {
    try {
        const { phone, otp, newPassword } = req.body;
        const user = await User.findOne({ phone });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (!verifyOtpMatch(user, otp)) {
            return res.status(401).json({ error: 'Invalid or expired OTP' });
        }

        await user.setPassword(newPassword);
        user.otp = '';
        user.otpExpiresAt = undefined;
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/check-user-type — returns whether a phone belongs to an admin
router.post('/check-user-type', checkUserTypeValidations, validate, async (req, res) => {
    try {
        const { phone } = req.body;
        const user = await User.findOne({ phone }).lean();
        res.json({ isAdmin: user?.role === 'admin' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/set-pin — store PIN for a user (called after OTP verification)
router.post('/set-pin', async (req, res) => {
    try {
        const { phone, pin } = req.body;
        if (!phone || !pin) {
            return res.status(400).json({ error: 'Phone and PIN required' });
        }
        const pinStr = String(pin);
        if (pinStr.length !== 4 || isNaN(pinStr)) {
            return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
        }
        const user = await User.findOne({ phone });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.role === 'admin') {
            return res.status(403).json({ error: 'Admin accounts do not use PIN — log in with OTP' });
        }
        user.pin = pinStr;
        await user.save();
        res.json({ success: true, message: 'PIN set successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/verify-pin — verify PIN and issue JWT
router.post('/verify-pin', async (req, res) => {
    try {
        const { phone, pin } = req.body;
        if (!phone || !pin) {
            return res.status(400).json({ error: 'Phone and PIN required' });
        }
        const pinStr = String(pin);
        const user = await User.findOne({ phone });
        if (!user) {
            // Check AccountRequest for a better error message
            const request = await AccountRequest.findOne({ phone });
            if (request?.status === 'pending') {
                return res.status(403).json({ error: 'Account pending approval. Admin will review your request shortly.' });
            }
            if (request?.status === 'rejected') {
                return res.status(403).json({ error: 'Account request rejected. Please contact admin for assistance.' });
            }
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.role === 'admin') {
            return res.status(403).json({ error: 'Admins must log in with OTP, not PIN' });
        }
        if (!user.pin) {
            return res.status(400).json({ error: 'PIN not set. Please log in with OTP.' });
        }
        if (user.pin !== pinStr) {
            return res.status(401).json({ error: 'Incorrect PIN' });
        }
        res.json({ token: issueToken(user), user: userResponse(user) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/signup-with-pin — create AccountRequest with PIN (after OTP verification)
router.post('/signup-with-pin', signupWithPinValidations, validate, async (req, res) => {
    try {
        const { phone, otp, pin } = req.body;
        const pinStr = String(pin);

        // Both firstName and lastName are required. Accept a single legacy `name` only as a
        // last-resort fallback (older client builds) — splitting on whitespace.
        let firstName = (req.body.firstName || '').trim();
        let lastName  = (req.body.lastName  || '').trim();
        const legacyName = (req.body.name || '').trim();
        if (!firstName && legacyName) {
            const parts = legacyName.split(/\s+/);
            firstName = parts[0] || '';
            lastName  = parts.slice(1).join(' ');
        }
        if (!firstName) return res.status(400).json({ error: 'First name is required' });
        if (!lastName)  return res.status(400).json({ error: 'Last name is required' });

        // Find temp user (created by send-otp) to verify OTP
        const tempUser = await User.findOne({ phone });
        if (!tempUser) return res.status(404).json({ error: 'No OTP request found for this phone' });
        if (!verifyOtpMatch(tempUser, otp)) {
            return res.status(401).json({ error: 'Invalid or expired OTP' });
        }

        // Block if already a real approved user
        if (tempUser.name) {
            return res.status(400).json({ error: 'Phone already registered' });
        }

        // Block if an AccountRequest already exists for this phone
        const existing = await AccountRequest.findOne({ phone });
        if (existing) {
            if (existing.status === 'pending') {
                return res.status(400).json({ error: 'Account request already pending. Please wait for admin approval.' });
            }
            if (existing.status === 'rejected') {
                return res.status(400).json({ error: 'Previous request was rejected. Contact admin.' });
            }
        }

        // Create AccountRequest. Pre-save hook will sync `name` from first+last.
        const request = await AccountRequest.create({
            firstName,
            lastName,
            ...(legacyName && !firstName ? { name: legacyName } : {}),
            phone,
            pin: pinStr,
        });

        // Delete temp User (created only for OTP)
        await User.deleteOne({ _id: tempUser._id });

        // Notify admins
        const admins = await User.find({ role: 'admin', expoPushToken: { $ne: '' } }).lean();
        if (admins.length > 0) {
            const { sendBulkNotifications } = require('../utils/notifications');
            const tokens = admins.map(a => a.expoPushToken).filter(Boolean);
            sendBulkNotifications(tokens, 'New Account Request', `${request.name} (${phone}) wants to join`, { type: 'new_request', requestId: String(request._id) }).catch(() => {});
        }

        res.json({
            success: true,
            message: 'Account request submitted. Awaiting admin approval.',
            user: { name: request.name, phone: request.phone, status: 'pending' },
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/update-pin — update PIN (after forgot PIN OTP flow)
router.post('/update-pin', async (req, res) => {
    try {
        const { phone, newPin } = req.body;
        if (!phone || !newPin) {
            return res.status(400).json({ error: 'Phone and new PIN required' });
        }
        const pinStr = String(newPin);
        if (pinStr.length !== 4 || isNaN(pinStr)) {
            return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
        }
        const user = await User.findOneAndUpdate(
            { phone },
            { pin: pinStr },
            { new: true }
        );
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ success: true, message: 'PIN updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/has-pin — check if user has a PIN set
router.post('/has-pin', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Phone required' });
        const user = await User.findOne({ phone }).lean();
        res.json({ hasPIN: !!(user && user.pin) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/auth/profile
router.put('/profile', auth, async (req, res) => {
    try {
        const { firstName, lastName, name, email, avatar, expoPushToken } = req.body;

        // Use save() (not findByIdAndUpdate) so the pre-save hook keeps `name` in sync
        // with firstName + lastName.
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (firstName !== undefined) {
            if (typeof firstName !== 'string' || !firstName.trim()) {
                return res.status(400).json({ error: 'First name cannot be empty' });
            }
            user.firstName = firstName.trim();
        }
        if (lastName !== undefined) {
            if (typeof lastName !== 'string' || !lastName.trim()) {
                return res.status(400).json({ error: 'Last name cannot be empty' });
            }
            user.lastName = lastName.trim();
        }
        // Allow direct `name` updates only when first/last weren't sent (legacy clients).
        if (name !== undefined && firstName === undefined && lastName === undefined) user.name = name;
        if (email          !== undefined) user.email = email;
        if (avatar         !== undefined) user.avatar = avatar;
        if (expoPushToken  !== undefined) user.expoPushToken = expoPushToken;

        await user.save();
        const fresh = await User.findById(user._id).select('-otp -otpExpiresAt');
        res.json({ user: fresh });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
