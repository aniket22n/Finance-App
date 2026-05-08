/**
 * Centralized App Configuration
 * Access all environment variables through this module
 */

module.exports = {
    // Server
    port: process.env.PORT || 5000,

    // Database
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/emigroup',

    // Auth
    jwtSecret: process.env.JWT_SECRET || 'fallback_dev_secret',
    jwtExpiry: process.env.JWT_EXPIRY || '30d',

    // Development
    devOtp: process.env.DEV_OTP,

    // Expo Push
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN,

    // Payment
    upiVpa: process.env.UPI_VPA || 'admin@upi',

    // SMS (optional)
    fast2smsApiKey: process.env.FAST2SMS_API_KEY,
};