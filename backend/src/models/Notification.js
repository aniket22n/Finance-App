const mongoose = require('mongoose');
const { Schema } = mongoose;

// Single in-app notification for a specific user. Fanned-out when an event affects
// multiple recipients (e.g. all admins get notified of a new account request).
const notificationSchema = new Schema({
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type:      { type: String, required: true },        // 'account_request' | 'payment_submitted' | 'account_approved' | 'payment_verified' | etc.
    title:     { type: String, required: true },
    body:      { type: String, default: '' },
    data:      { type: Schema.Types.Mixed, default: {} },  // route-target + entity ids for tap-to-navigate later
    read:      { type: Boolean, default: false, index: true },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
