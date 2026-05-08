const mongoose = require('mongoose');

const emiCycleSchema = new mongoose.Schema({
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
    month: { type: Number, required: true },
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    emiAmount: { type: Number, required: true },
    reducedEmi: { type: Number, required: true },
    potAmount: { type: Number, required: true },
    status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
    completedAt: { type: Date },
}, { timestamps: true });

emiCycleSchema.index({ group: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('EMICycle', emiCycleSchema);
