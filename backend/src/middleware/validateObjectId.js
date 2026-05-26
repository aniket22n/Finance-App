const mongoose = require('mongoose');

// router.param handler — rejects malformed ObjectId route params with 404 before the
// handler runs, so a bad id returns a clean 404 instead of a Mongoose CastError 500.
// Registered per-router via router.param('id'|'groupId'|..., validateObjectId).
module.exports = function validateObjectId(req, res, next, value) {
    if (!mongoose.isValidObjectId(value)) {
        return res.status(404).json({ error: 'Not found' });
    }
    next();
};
