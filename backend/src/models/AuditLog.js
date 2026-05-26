const mongoose = require('mongoose');
const { Schema } = mongoose;

// Immutable audit trail of sensitive admin actions (currently payment verify/reject/
// change-status). Written by the auditLogger middleware AFTER a successful response —
// it never participates in the request's own logic, so it cannot affect behavior.
const auditLogSchema = new Schema({
    actor:      { type: Schema.Types.ObjectId, ref: 'User', index: true }, // admin who acted
    actorPhone: { type: String, default: '' },
    action:     { type: String, required: true, index: true },             // 'payment_verify' | 'payment_reject' | 'payment_change_status'
    targetType: { type: String, default: 'Payment' },
    targetId:   { type: String, default: '' },                             // payment id
    method:     { type: String, default: '' },
    path:       { type: String, default: '' },
    statusCode: { type: Number },
    meta:       { type: Schema.Types.Mixed, default: {} },                 // { newStatus, amount, member, reason }
}, { timestamps: { createdAt: true, updatedAt: false } });

auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
