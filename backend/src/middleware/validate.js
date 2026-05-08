/**
 * Validation Middleware using express-validator
 * Provides consistent validation across all routes
 */
const { validationResult } = require('express-validator');

/**
 * Middleware to check validation results
 * Returns 400 with formatted errors if validation failed
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

module.exports = { validate };