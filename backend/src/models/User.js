const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    phone: { type: String, required: true, unique: true },
    email: { type: String, default: '' },
    avatar: { type: String, default: '' },
    role: { type: String, enum: ['member', 'admin'], default: 'member' },
    expoPushToken: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    otp: { type: String, default: '' },
    otpExpiresAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
