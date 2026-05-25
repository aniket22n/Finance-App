const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // Canonical name fields. The legacy `name` is auto-derived from firstName+lastName
    // on save so existing display code (member cards, lists, etc.) keeps working.
    firstName: { type: String, default: '' },
    lastName:  { type: String, default: '' },
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

// Keep `name` in sync with firstName + lastName on every save. Only overwrites
// when at least one of first/last is set, so legacy users (with `name` only) are
// untouched until they edit their profile.
userSchema.pre('save', function (next) {
    if (this.firstName || this.lastName) {
        this.name = [this.firstName, this.lastName].filter(Boolean).join(' ').trim();
    }
    next();
});

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
