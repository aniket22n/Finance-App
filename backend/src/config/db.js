const mongoose = require('mongoose');

const connectDB = async (retries = 3) => {
  const uri = process.env.MONGO_URI;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 50,
        wtimeoutMS: 2500,
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`❌ MongoDB connection attempt ${attempt}/${retries} failed: ${error.message}`);

      if (attempt === retries) {
        console.error('\n' + '='.repeat(60));
        console.error('  MongoDB is not reachable!');
        console.error('  Current URI: ' + uri);
        console.error('');
        console.error('  QUICK FIX — Use MongoDB Atlas FREE tier:');
        console.error('  1. Go to https://cloud.mongodb.com');
        console.error('  2. Create a FREE M0 cluster');
        console.error('  3. Create a database user (username + password)');
        console.error('  4. Click "Connect" → "Drivers" → copy the URI');
        console.error('  5. Paste it in backend/.env as MONGO_URI=<your_uri>');
        console.error('  6. Replace <password> in the URI with your password');
        console.error('='.repeat(60) + '\n');
        throw new Error('MongoDB connection failed after ' + retries + ' attempts');
      }

      // Wait before retry
      await new Promise(r => setTimeout(r, 2000));
    }
  }
};

module.exports = connectDB;
