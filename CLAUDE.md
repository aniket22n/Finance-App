# EMI Group Finance App — Claude Code Project Guide

## Project Overview

EMI Group is a chit-fund / rotating savings management system for Indian member groups. Members pay a fixed monthly EMI into a shared pot; each month one member wins the pot via a BC (Beneficiary Customer) draw and receives a reduced EMI going forward. Real money, real personal data — treat all security and payment logic with production-grade care.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express, MongoDB (Mongoose), JWT auth, node-cron |
| Mobile | React Native + Expo (SDK 52), React Navigation 6, Axios — **single app for both members AND admins** |
| Push Notifications | Firebase FCM via Expo Push SDK (built) |
| Email | Gmail SMTP via Nodemailer (to build) |
| Payments | Razorpay (to integrate) — UPI deeplink currently |
| Database | MongoDB Atlas (free M0 tier) |
| Deployment | Render (backend), Vercel (admin), Expo EAS + Google Play (mobile) |

---

## Folder Structure

```
/
├── backend/
│   └── src/
│       ├── config/         # DB config, appConfig.js (bank details, settings)
│       ├── jobs/           # reminderScheduler.js (node-cron, daily 9 AM IST)
│       ├── middleware/      # auth.js, validation middleware
│       ├── models/         # User, Group, Payment, EMICycle, ReminderLog
│       ├── routes/         # auth, groups, payments, emi, admin
│       ├── utils/          # emiEngine.js, notifications.js
│       └── server.js
├── mobile/
│   └── src/
│       ├── screens/        # LoginScreen, SignUpScreen, HomeScreen, GroupListScreen, GroupDetailScreen, PaymentScreen, ProfileScreen, AdminDashboardScreen
│       ├── components/     # Avatar, GroupCard, MemberCard, PaymentCard, ProgressRing
│       ├── services/       # api.js (Axios + JWT interceptors)
│       └── context/        # AuthContext
```

---

## Data Models

### User
`name, phone, email, avatar, role (member|admin), expoPushToken, otp, otpExpiry`

### Group
`name, potAmount, emiAmount, reducedEmiAmount, monthlyConfig[], members[], currentMonth, totalMonths, status (active|completed|paused), dueDate (day-of-month), reminderDaysBefore (default: [3,1]), reminderDaysAfter (default: [1,3,7])`

### Payment
`user, group, month, amount, status (pending|paid|verified|failed), paymentMethod (upi|bank|cash|other), upiRef, receipt (base64/URL), verifiedBy, verifiedAt`

### EMICycle
`group, month, winner (User ref), emiAmount, reducedAmount, potAmount, status (active|completed), createdAt`

### ReminderLog
`group, user, type (before|overdue), sentAt, daysOffset`

---

## EMI Business Rules

- **Pot calculation**: `potAmount = emiAmount × memberCount`
- **Winner benefit**: Winner receives `reducedEmiAmount` for all remaining months (never pays full EMI again)
- **BC Draw**: Each member can only win once per group lifecycle — check `EMICycle.findOne({ group, winner: memberId })` before drawing
- **Eligible members**: Members who have NOT yet won a cycle in the current group
- **Cycle creation**: Admin selects winner from eligible (non-winner) members only
- **Month progression**: `currentMonth` increments on each new cycle; group completes when `currentMonth === totalMonths`

---

## Payment Rules

- **UPI**: 0% fee — default option, shown first
- **Card / Razorpay**: +2% convenience fee — displayed to member before confirmation, NEVER absorbed by the system
- **Fee calculation**: `cardTotal = baseAmount * 1.02` — computed server-side, shown client-side before confirm
- **Payment status flow**: `pending → paid → verified` (success) or `pending → failed` (failure) — no other transitions
- **Server-side validation**: Payment amount MUST be validated server-side against the group's EMI amount — never trust client body for amount
- **Razorpay webhook**: Signature must be verified server-side using `crypto.createHmac` before marking any payment as verified
- **Receipt upload**: Accepted for bank/cash payments; stored as base64 or URL on Payment model

---

## Deployment & Infrastructure

| Service | Platform | Notes |
|---------|----------|-------|
| Backend | Render.com (free tier) | Build: `npm install`, Start: `node src/server.js` |
| Admin | Vercel (free tier) | Env: `VITE_API_URL` |
| Database | MongoDB Atlas (free M0) | Whitelist `0.0.0.0/0` for Render |
| Mobile | Expo EAS → Google Play | Android AAB only; EAS manages signing keys |

### Environment Variables (never hardcode, never commit)

**Backend (set in Render dashboard)**:
```
MONGO_URI, JWT_SECRET, NODE_ENV, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
GMAIL_USER, GMAIL_APP_PASSWORD, FCM_SERVER_KEY, DEV_OTP (dev only)
```

**Admin (set in Vercel dashboard)**:
```
VITE_API_URL
```

**Mobile (Expo config / app.json extra)**:
```
API_BASE  ← must point to production Render URL, never hardcoded IP
```

### UptimeRobot Monitoring
Pings `GET /health` every 5 minutes to prevent Render free-tier cold starts. Confirm monitor is active after every backend deploy.

---

## Notification Channels

| Channel | Status | Notes |
|---------|--------|-------|
| Firebase FCM (Expo Push SDK) | Built | `backend/src/utils/notifications.js` |
| Gmail SMTP (Nodemailer) | To build | Reminder emails before/after due date |
| SMS / WhatsApp | Confirm with client | Not started — clarify requirement before building |

---

## Known Gaps — Priority Build Order

### 1. Razorpay Integration (CRITICAL — real money)
- Backend: `POST /api/payments/create-order` → Razorpay order, `POST /api/payments/verify-razorpay` → webhook signature check
- Mobile: PaymentScreen — show UPI as default (0%), card option with +2% fee preview
- Never trust client-sent amount — always recompute server-side

### 2. BC Draw — Eligible Members & Draw History
- Backend: `GET /api/emi/eligible/:groupId` — members who haven't won yet
- Mobile: GroupDetailScreen — "Next Draw" section + draw history timeline
- Admin: GroupDetail new-cycle modal — filter dropdown to eligible members only
- Notify all eligible members when new cycle created

### 3. Gmail EMI Reminders (cron already exists at `backend/src/jobs/reminderScheduler.js`)
- Add `dueDate`, `reminderDaysBefore`, `reminderDaysAfter` to Group model
- Enhance scheduler to send push + email reminders
- Admin Settings page — configure reminder timing per group

### 4. Enhanced Admin Dashboard Charts
- Revenue trend line chart (last 30 days)
- Payment status donut chart
- Overdue alerts section
- Group health cards
- Backend: `/api/admin/analytics/revenue`, `/api/admin/analytics/overdue`, `/api/admin/analytics/group-health`
- Recharts already installed

### 5. API_BASE Production Config (CRITICAL for Play Store)
- `mobile/src/services/api.js` currently hardcoded to local IP `10.22.231.66:5000`
- Must use `app.json` extra config + `Constants.expoConfig.extra.apiBase`

---

## Coding Standards

### All layers
- `async/await` only — no `.then()/.catch()` chains
- No hardcoded IPs, secrets, or API keys anywhere in source
- Validate all user inputs at system boundaries before any DB operation
- Never modify `.env` directly — tell the user to set vars in Render/Vercel dashboard

### Backend
- All API responses: `{ success: true/false, data: {}, message: "" }`
- JWT in `Authorization: Bearer <token>` header — `auth` middleware on ALL protected routes
- Use `.lean()` for read-only Mongoose queries (performance)
- Compound indexes on `(user, group, month)` for Payment; `status` index on Payment
- OTP must NOT be logged (`console.log`) in production — guarded by `NODE_ENV`
- Remove dev OTP bypass (`DEV_OTP`) check before production deploy

### Admin
- Functional components only, no class components
- Recharts for all charts — chart colors: `#e94560`, `#00b894`, `#6c5ce7`, `#f0a500`
- All API calls exclusively through `/admin/src/services/api.js`
- Always implement loading + error states on every data-fetching component
- Dark theme via CSS variables: `--bg-card`, `--border`, `--accent`

### Mobile
- `StyleSheet.create()` for ALL styles — zero inline style objects
- Expo packages only via `npx expo install` — never bare RN CLI packages
- Android only — no iOS-specific code, no `Platform.OS === 'ios'` branches for features
- `API_BASE` from env config only — never hardcoded
- UPI shown first (0% fee); Card option shows +2% fee before user confirms

---

## Security Checklist (run before every deploy)

- [ ] `auth` middleware present on all payment and user routes
- [ ] No user input passed directly into MongoDB query without sanitization
- [ ] No API keys or secrets in source files
- [ ] Payment amount validated server-side (not from client body)
- [ ] JWT secret is not hardcoded
- [ ] OTP not logged in production
- [ ] DEV_OTP bypass disabled in production
- [ ] Razorpay webhook signature verified server-side
- [ ] OTP and login routes have rate limiting
- [ ] HTTPS enforced in production (Render handles this)

---

## Agent Delegation Rules

| Task | Use Agent |
|------|-----------|
| New route, model, cron job, Razorpay/Gmail/FCM integration | `backend-dev` |
| Admin portal page, chart, form, table | `admin-dev` |
| Mobile screen, component, navigation, push notification UI | `mobile-dev` |
| Writing or updating Jest tests | `tdd-guide` |
| Pre-merge code quality check | `code-reviewer` |
| Pre-deploy security audit | `security-reviewer` |
| GitHub push, Render deploy, Vercel deploy, EAS build, Play Store | `deployer` |

---

## Do Not Rules

- **Never** modify `.env` directly — always tell user to set in dashboard
- **Never** skip input validation on any route that touches the DB
- **Never** build for iOS — Android only
- **Never** hardcode `API_BASE`, JWT secrets, Razorpay keys, or MongoDB URI
- **Never** trust client-sent payment amounts — always recompute server-side
- **Never** log OTPs in production
- **Never** mark a Razorpay payment as verified without checking webhook signature
- **Never** use bare React Native CLI packages — Expo SDK only

---

## Known Issues from Reviews (agent-work/)

### Backend
- `GET /payments/pending` was using `paid` status — should be `pending` (verify fix)
- No pagination on list endpoints (users, groups, payments) — add `skip`/`limit`
- No compound indexes on Payment model yet

### Mobile
- `pendingCount` on HomeScreen was `activeGroups.length` — wrong (should be pending payment count)
- "Total Pot" showed sum of all pots, not user's share
- Hardcoded colors in some screens — should use theme variables

### Admin
- No toast/notification feedback on form actions
- Tables not sortable, no pagination
- No client-side form validation
- No confirm dialogs before delete actions

### Security
- `console.log(otp)` present in auth routes — remove before production
- Dev OTP bypass must be disabled in production
- Add audit logging for payment verification actions
