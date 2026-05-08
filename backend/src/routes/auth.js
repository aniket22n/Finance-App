const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const config = require('../config/appConfig');
const { validate, sendOtpValidations, verifyOtpValidations } = require('../middleware/validators');

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
        const otp = config.devOtp || Math.floor(1000 + Math.random() * 9000).toString();
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
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Check OTP
        const validOtp = user.otp === otp && user.otpExpiresAt > new Date();
        const devMode = config.devOtp && otp === config.devOtp;

        if (!validOtp && !devMode) {
            return res.status(401).json({ error: 'Invalid or expired OTP' });
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

// PUT /api/auth/profile
router.put('/profile', auth, async (req, res) => {
    try {
        const { name, email, avatar, expoPushToken } = req.body;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (email !== undefined) updates.email = email;
        if (avatar !== undefined) updates.avatar = avatar;
        if (expoPushToken !== undefined) updates.expoPushToken = expoPushToken;

        const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
            .select('-otp -otpExpiresAt');

        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
