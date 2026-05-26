const AuditLog = require('../models/AuditLog');

// Maps an admin payment-action request to an audit action name. Returns null for
// requests we don't audit (so the middleware stays a no-op for everything else).
function deriveAction(req) {
    if (req.method !== 'POST') return null;
    const p = req.path; // relative to the mount point (/api/admin/payments)
    if (/\/verify\/?$/.test(p))        return 'payment_verify';
    if (/\/reject\/?$/.test(p))        return 'payment_reject';
    if (/\/change-status\/?$/.test(p)) return 'payment_change_status';
    return null;
}

// Non-invasive audit recorder. Mounted ahead of the admin payment routes. It hooks
// res.json to capture the response body and writes an AuditLog on 'finish' (after the
// real handler ran, so req.user is populated). Best-effort: any failure is swallowed
// and never affects the response the client receives.
module.exports = function auditLogger(req, res, next) {
    const action = deriveAction(req);
    if (!action) return next();

    let body;
    const originalJson = res.json.bind(res);
    res.json = (data) => { body = data; return originalJson(data); };

    res.on('finish', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return; // only successful actions
        const payment = body && body.payment;
        AuditLog.create({
            actor:      req.user && req.user._id,
            actorPhone: (req.user && req.user.phone) || '',
            action,
            targetType: 'Payment',
            targetId:   req.params.id || (payment && String(payment._id)) || '',
            method:     req.method,
            path:       req.originalUrl,
            statusCode: res.statusCode,
            meta: {
                newStatus: payment && payment.status,
                amount:    payment && payment.amount,
                member:    payment && payment.user && (payment.user.name || payment.user.phone),
                reason:    req.body && req.body.reason,
            },
        }).catch(() => {});
    });

    next();
};
