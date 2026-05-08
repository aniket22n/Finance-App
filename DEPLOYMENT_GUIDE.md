# EMI Group Finance App — Deployment Guide

## 🚀 Quick Start (Local Development)

### 1. Backend
```bash
cd backend
cp .env.example .env    # Configure MongoDB URI
npm install
npm run dev             # Starts on http://localhost:5000
```

### 2. Mobile App
```bash
cd mobile
npm install
npx expo start          # Scan QR with Expo Go app
```

### 3. Admin Dashboard
```bash
cd admin
npm install
npm run dev             # Opens http://localhost:3000
```

### 4. First Admin Setup
```bash
# 1. Send OTP to your phone (uses DEV_OTP=1234 locally)
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"9876543210\"}"

# 2. Verify OTP and get token
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"9876543210\", \"otp\":\"1234\"}"

# 3. Promote to admin (run in MongoDB shell or Compass)
# db.users.updateOne({phone:"9876543210"}, {$set:{role:"admin"}})
```

---

## 📱 Play Store Deployment

### Step 1: Configure EAS Build
```bash
cd mobile
npm install -g eas-cli
eas login                    # Login with Expo account
eas build:configure          # Auto-configures native projects
```

### Step 2: Build Android App Bundle (.aab)
```bash
# Preview APK (for testing)
eas build --platform android --profile preview

# Production AAB (for Play Store)
eas build --platform android --profile production
```

### Step 3: Generate Keystore
EAS automatically manages your signing keys. To use your own:
```bash
# Generate keystore manually (optional)
keytool -genkey -v -keystore emigroup-release.keystore \
  -alias emigroup -keyalg RSA -keysize 2048 -validity 10000

# Configure in eas.json credentials
```

### Step 4: Google Play Console Setup
1. Go to [play.google.com/console](https://play.google.com/console)
2. Pay $25 one-time developer fee
3. Create new app → "EMI Group"
4. Fill in:
   - **App name**: EMI Group
   - **Default language**: English (India)
   - **App type**: App
   - **Category**: Finance
5. Upload store assets (see below)
6. Complete content rating questionnaire
7. Set target audience: 18+

### Step 5: Store Assets Required
| Asset | Size | Notes |
|-------|------|-------|
| App Icon | 512x512 PNG | High-res icon |
| Feature Graphic | 1024x500 PNG | Play Store banner |
| Screenshots | Min 2, up to 8 | Phone screenshots |
| 7" Tablet Screenshots | Min 1 | Tablet screenshots |

### Step 6: Upload & Release
```bash
# Download the .aab from EAS build dashboard
# Or submit directly:
eas submit --platform android --profile production
```

### Step 7: Privacy Policy
Host the `privacy-policy.html` file at a public URL (e.g., GitHub Pages, Vercel).
Provide this URL in Play Console → Policy → Privacy Policy.

---

## ☁️ Backend Deployment (Render.com — FREE)

### Step 1: Push to GitHub
```bash
cd backend
git init
git add .
git commit -m "Initial backend"
git remote add origin https://github.com/YOUR_REPO.git
git push -u origin main
```

### Step 2: Deploy on Render
1. Go to [render.com](https://render.com) → New Web Service
2. Connect your GitHub repo → Select `backend` folder
3. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
   - **Instance Type**: Free
4. Add Environment Variables:
   - `MONGO_URI` = Your MongoDB Atlas connection string
   - `JWT_SECRET` = Strong random string
   - `NODE_ENV` = production

### Step 3: MongoDB Atlas (FREE 512MB)
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create free M0 cluster
3. Create database user
4. Whitelist IP: `0.0.0.0/0` (for Render)
5. Get connection string → Add to Render env vars

---

## 🌐 Admin Dashboard Deployment (Vercel — FREE)

```bash
cd admin
# Deploy to Vercel
npx -y vercel --prod

# Or connect GitHub repo to Vercel dashboard
```

Add environment variable in Vercel:
- `VITE_API_URL` = `https://your-backend.onrender.com/api`

---

## 💰 Cost Summary

| Service | Cost | Tier |
|---------|------|------|
| Expo EAS Builds | $0 | 30 builds/month free |
| Render.com Backend | $0 | Free 512MB RAM |
| MongoDB Atlas | $0 | Free M0 512MB |
| Expo Push Notifications | $0 | Unlimited |
| Vercel Admin Dashboard | $0 | Free tier |
| Google Play Console | $25 | One-time |
| **Monthly Total** | **$0** | ✅ |

---

## 📋 Production Checklist

- [ ] MongoDB Atlas cluster created (free M0)
- [ ] Backend deployed on Render + env vars set
- [ ] Admin dashboard deployed on Vercel
- [ ] First admin user created + promoted
- [ ] Privacy policy hosted publicly
- [ ] EAS build configured + first build complete
- [ ] App icon + screenshots prepared
- [ ] Play Console account created ($25)
- [ ] Store listing completed
- [ ] Content rating questionnaire done
- [ ] AAB uploaded to Play Console
- [ ] Privacy policy URL added
- [ ] App submitted for review
