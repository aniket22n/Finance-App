const mongoose = require('mongoose');
const { Schema } = mongoose;

const accountRequestSchema = new Schema({
    name:       { type: String, required: true },
    phone:      { type: String, required: true, unique: true },
    pin:        { type: String, required: true },
    status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    rejectReason: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('AccountRequest', accountRequestSchema);
