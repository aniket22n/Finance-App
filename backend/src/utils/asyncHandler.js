/**
 * Async handler wrapper - catches errors and passes to next()
 * Avoids repetitive try/catch in route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { asyncHandler };