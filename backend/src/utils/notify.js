// Helper for emitting in-app notifications. Wraps the model so the call-sites stay
// short and so we can later add push fan-out alongside without touching every route.
const Notification = require('../models/Notification');
const User = require('../models/User');

// Create one notification per recipientId.
// recipients: User _id (single) or array of _ids
// Returns the array of created docs (don't await if you don't need them).
async function notifyUsers(recipients, { type, title, body = '', data = {} }) {
    const ids = Array.isArray(recipients) ? recipients : [recipients];
    if (ids.length === 0) return [];
    const docs = ids.map(id => ({ recipient: id, type, title, body, data }));
    try {
        return await Notification.insertMany(docs);
    } catch (e) {
        // Notifications must never block the originating action. Log and swallow.
        console.warn('notifyUsers failed:', e.message);
        return [];
    }
}

// Convenience: fan out to every admin (e.g. new account request, new payment).
async function notifyAllAdmins(payload) {
    const admins = await User.find({ role: 'admin' }).select('_id').lean();
    return notifyUsers(admins.map(a => a._id), payload);
}

module.exports = { notifyUsers, notifyAllAdmins };
