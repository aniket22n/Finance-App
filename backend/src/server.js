require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// ─── Environment Validation ───
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
    console.error(`❌ Missing required env vars: ${missing.join(', ')}`);
    console.error('   Copy .env.example to .env and fill in values');
    process.exit(1);
}
console.log('✅ Environment config validated');

// Route imports
const authRoutes = require('./routes/auth');
const groupRoutes = require('./routes/groups');
const paymentRoutes = require('./routes/payments');
const emiRoutes = require('./routes/emi');
const adminRoutes = require('./routes/admin');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
    res.json({
        name: 'EMI Group Finance API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/emi', emiRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: true, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('💥 Server Error:', err.message);
    const status = err.status || 500;
    const response = { error: true, message: err.message || 'Internal server error' };

    // Include stack trace in dev mode
    if (process.env.NODE_ENV !== 'production' && err.stack) {
        response.stack = err.stack.split('\n').slice(1, 3).join('\n');
    }

    res.status(status).json(response);
});

// Start server
const PORT = process.env.PORT || 5000;

// Start Express first, then try MongoDB
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
    console.log(`💚 Health: http://localhost:${PORT}/health`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`⚠️  Port ${PORT} is busy. Retrying in 2 seconds...`);
        setTimeout(() => {
            server.close();
            server.listen(PORT);
        }, 2000);
    } else {
        console.error('Server error:', err);
    }
});

// Graceful shutdown (helps with --watch mode restarts)
process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });

const { startScheduler } = require('./jobs/reminderScheduler');

connectDB().then(() => {
    console.log('✅ Database ready — all features active');
    startScheduler();
}).catch(err => {
    console.error('⚠️  Server running WITHOUT database — API calls will fail');
    console.error('    Fix: Set MONGO_URI in backend/.env to a valid MongoDB URI\n');
});

module.exports = app;


