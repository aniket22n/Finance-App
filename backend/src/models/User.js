const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    phone: { type: String, required: true, unique: true },
    email: { type: String, default: '' },
    avatar: { type: String, default: '' },
    role: { type: String, enum: ['member', 'admin'], default: 'member' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    expoPushToken: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    otp: { type: String, default: '' },
    otpExpiresAt: { type: Date },
    passwordHash: { type: String, default: '' },
    pin: { type: String, default: null, minlength: 4, maxlength: 4 },
}, { timestamps: true });

userSchema.methods.setPassword = async function (plain) {
    this.passwordHash = await bcrypt.hash(plain, 10);
};

userSchema.methods.comparePassword = async function (plain) {
    if (!this.passwordHash) return false;
    return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.hasPassword = function () {
    return !!this.passwordHash;
};

module.exports = mongoose.model('User', userSchema);
