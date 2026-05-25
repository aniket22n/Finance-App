/**
 * Shared Validation Rules for express-validator
 */
const { body, param, query } = require('express-validator');
const { validate } = require('./validate');

// ─── Common Rules ───

// Valid MongoDB ObjectId (24 hex characters)
const objectId = (field = 'id') => param(field).isMongoId().withMessage(`Invalid ${field} format`);

// Valid phone number (10 digits)
const phone = () => body('phone')
    .isMobilePhone('en-IN')
    .withMessage('Invalid phone number format')
    .trim();

// Valid OTP (4-6 digits)
const otp = () => body('otp')
    .isLength({ min: 4, max: 6 })
    .isNumeric()
    .withMessage('OTP must be 4-6 digit number');

// Positive integer
const positiveInt = (field, min = 1) => body(field)
    .isInt({ min })
    .withMessage(`${field} must be a positive integer`);

// Positive number (for amounts)
const positiveNumber = (field) => body(field)
    .isFloat({ min: 0.01 })
    .withMessage(`${field} must be a positive number`);

// Required string
const requiredString = (field, minLen = 1) => body(field)
    .isString()
    .isLength({ min: minLen })
    .withMessage(`${field} is required`)
    .trim();

// Optional string
const optionalString = (field) => body(field)
    .optional()
    .isString()
    .trim();

// Enum validation
const enumValue = (field, allowedValues) => body(field)
    .isIn(allowedValues)
    .withMessage(`${field} must be one of: ${allowedValues.join(', ')}`);

// Password (min 6 chars)
const password = (field = 'password') => body(field)
    .isString()
    .isLength({ min: 6, max: 128 })
    .withMessage('Password must be at least 6 characters');

// PIN (exactly 4 digits)
const pin = (field = 'pin') => body(field)
    .isString()
    .matches(/^\d{4}$/)
    .withMessage('PIN must be exactly 4 digits');

// ─── Auth Validators ───
const sendOtpValidations       = [phone()];
const verifyOtpValidations     = [phone(), otp()];
const loginPasswordValidations = [phone(), password()];
const signupValidations        = [phone(), otp(), password(), optionalString('name'), optionalString('firstName'), optionalString('lastName')];
const resetPasswordValidations = [phone(), otp(), password('newPassword')];

// ─── PIN Auth Validators ───
const checkUserTypeValidations = [phone()];
const loginWithPinValidations  = [phone(), pin()];
const signupWithPinValidations = [phone(), otp(), pin(), optionalString('name'), optionalString('firstName'), optionalString('lastName')];
const setPinValidations        = [pin()];
const resetPinValidations      = [phone(), otp(), pin()];

// ─── Payment Validators ───
const initiatePaymentValidations = [
    body('groupId').isMongoId().withMessage('Invalid group ID'),
    body('month').isInt({ min: 1, max: 120 }).withMessage('Month must be 1-120'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be positive'),
    optionalString('paymentMethod'),
    optionalString('upiTransactionId'),
    optionalString('upiRef'),
];

// ─── Group Validators ───
const createGroupValidations = [
    requiredString('name', 2),
    optionalString('description'),
    body('potAmount').isFloat({ min: 100 }).withMessage('Pot amount must be at least 100'),
    body('emiAmount').isFloat({ min: 100 }).withMessage('EMI amount must be at least 100'),
    body('reducedEmi').isFloat({ min: 0 }).withMessage('Reduced EMI must be 0 or more'),
    body('totalMonths').isInt({ min: 1, max: 120 }).withMessage('Total months must be 1-120'),
    body('minMembers').optional().isInt({ min: 2, max: 100 }).withMessage('Min members 2-100'),
    body('maxMembers').optional().isInt({ min: 2, max: 100 }).withMessage('Max members 2-100'),
];

const updateGroupValidations = [
    objectId('id'),
    optionalString('name'),
    optionalString('description'),
    body('potAmount').optional().isFloat({ min: 100 }).withMessage('Pot amount must be at least 100'),
    body('emiAmount').optional().isFloat({ min: 100 }).withMessage('EMI amount must be at least 100'),
    body('reducedEmi').optional().isFloat({ min: 0 }).withMessage('Reduced EMI must be 0 or more'),
    body('status').optional().isIn(['pending', 'active', 'completed', 'paused']).withMessage('Invalid status'),
];

const addMemberValidations = [
    objectId('id'),
    body('userId').isMongoId().withMessage('Invalid user ID'),
];

// ─── EMI Cycle Validators ───
const createCycleValidations = [
    body('groupId').isMongoId().withMessage('Invalid group ID'),
    body('winnerId').isMongoId().withMessage('Invalid winner ID'),
];

// ─── Pagination ───
const paginationValidations = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
];

module.exports = {
    validate,
    // Common
    objectId, phone, otp, positiveInt, positiveNumber, requiredString, optionalString, enumValue,
    // Auth (password)
    sendOtpValidations, verifyOtpValidations,
    loginPasswordValidations, signupValidations, resetPasswordValidations,
    // Auth (PIN)
    checkUserTypeValidations, loginWithPinValidations, signupWithPinValidations,
    setPinValidations, resetPinValidations,
    // Payments
    initiatePaymentValidations,
    // Groups
    createGroupValidations, updateGroupValidations, addMemberValidations,
    // EMI
    createCycleValidations,
    // Pagination
    paginationValidations,
};