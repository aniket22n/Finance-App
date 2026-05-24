const mongoose = require('mongoose');
const { Schema } = mongoose;

const accountRequestSchema = new Schema({
    // Same dual-storage as User: split first+last, with `name` auto-derived for legacy reads.
    firstName:    { type: String, default: '' },
    lastName:     { type: String, default: '' },
    name:         { type: String, default: '' },
    phone:        { type: String, required: true, unique: true },
    pin:          { type: String, required: true },
    status:       { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedAt:   { type: Date, default: null },
    reviewedBy:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
    rejectReason: { type: String, default: null },
}, { timestamps: true });

// Keep `name` in sync from firstName + lastName so any code reading request.name still works.
accountRequestSchema.pre('save', function (next) {
    if (this.firstName || this.lastName) {
        this.name = [this.firstName, this.lastName].filter(Boolean).join(' ').trim();
    }
    next();
});

// Validate at least one identity field is present (replaces the old `name` required check).
accountRequestSchema.pre('validate', function (next) {
    if (!(this.firstName || this.lastName || this.name)) {
        return next(new Error('First name (or full name) is required'));
    }
    next();
});

module.exports = mongoose.model('AccountRequest', accountRequestSchema);
