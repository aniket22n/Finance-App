const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    month: { type: Number, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'paid', 'verified', 'failed'], default: 'pending' },
    upiRef: { type: String, default: '' },
    upiTransactionId: { type: String, default: '' },
    paymentMethod: { type: String, enum: ['upi', 'bank', 'cash', 'other'], default: 'upi' },
    receipt: { type: String, default: '' },
    paidAt: { type: Date },
    verifiedAt: { type: Date },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, default: '' },
}, { timestamps: true });

paymentSchema.index({ user: 1, group: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Payment', paymentSchema);
