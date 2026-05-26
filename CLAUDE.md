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
| Payments | UPI deeplink + bank/cash with manual admin verification (no payment gateway) |
| Database | MongoDB Atlas (free M0 tier) |
| Deployment | Render (backend), Expo EAS + Google Play (mobile) |

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

- **Methods**: UPI deeplink (default), bank transfer, and cash — all verified manually by an admin. No payment gateway / online card processing.
- **Payment status flow**: `pending → paid → verified` (success) or `pending → rejected`/`failed` — admin actions are OTP-gated; `change-status` only allows `verified ↔ rejected`
- **Server-authoritative amount**: `/payments/initiate` uses the due stored on the `Payment` record (created at draw time), NEVER the client-sent `amount`; a month with no existing due is rejected
- **Receipt upload**: Accepted for bank/cash payments; stored as base64 or URL on Payment model
- **Audit trail**: admin verify/reject/change-status actions are recorded to the `AuditLog` collection by a non-invasive post-response middleware

---

## Deployment & Infrastructure

| Service | Platform | Notes |
|---------|----------|-------|
| Backend | Render.com (free tier) | Build: `npm install`, Start: `node src/server.js` |
| Database | MongoDB Atlas (free M0) | Whitelist `0.0.0.0/0` for Render |
| Mobile | Expo EAS → Google Play | Android AAB only; EAS manages signing keys |

> The admin UI is part of the mobile app (role-gated). There is no separate web portal / Vercel deploy.

### Environment Variables (never hardcode, never commit)

**Backend (set in Render dashboard)**:
```
MONGO_URI, JWT_SECRET, NODE_ENV,
GMAIL_USER, GMAIL_APP_PASSWORD, FCM_SERVER_KEY, FAST2SMS_API_KEY, DEV_OTP (dev only)
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

> Payment gateway (Razorpay) is **out of scope** — client confirmed UPI/bank/cash with manual admin verification is sufficient. Do not add a gateway.

### 1. Gmail EMI Reminders (cron already exists at `backend/src/jobs/reminderScheduler.js`, runs `0 10 * * *`)
- Scheduler currently sends Expo push only — add Gmail SMTP (Nodemailer) email reminders
- Admin settings to configure reminder timing per group

### 2. SMS / WhatsApp reminders
- Confirm requirement with client before building (Fast2SMS hook exists for OTP)

### Done / not gaps
- Payment integrity — `/payments/initiate` is server-authoritative on amount; admin actions OTP-gated + audit-logged (`AuditLog`)
- BC Draw eligibility (`GET /api/emi/eligible/:groupId`) + POT plan (`configure-pot`)
- Admin analytics (`/analytics/revenue`, `/analytics/overdue`, `/analytics/group-health`)
- `API_BASE` from `Constants.expoConfig.extra.apiBase` (no longer hardcoded)

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
- Payment amount is server-provided — show the due from the API; never compute amounts client-side

---

## Security Checklist (run before every deploy)

- [ ] `auth` middleware present on all payment and user routes
- [ ] No user input passed directly into MongoDB query without sanitization
- [ ] No API keys or secrets in source files
- [ ] Payment amount taken from the stored due, never from client body
- [ ] JWT secret is not hardcoded
- [ ] OTP not logged in production
- [ ] DEV_OTP bypass disabled in production
- [ ] Admin payment actions OTP-gated
- [ ] OTP and login routes have rate limiting
- [ ] HTTPS enforced in production (Render handles this)

---

## Agent Delegation Rules

| Task | Use Agent |
|------|-----------|
| New route, model, cron job, Gmail/FCM integration | `backend-dev` |
| Mobile screen (member or admin), component, navigation, push notification UI | `mobile-dev` |
| Writing or updating Jest tests | `tdd-guide` |
| Pre-merge code quality check | `code-reviewer` |
| Pre-deploy security audit | `security-reviewer` |
| GitHub push, Render deploy, EAS build, Play Store | `deployer` |

---

## Do Not Rules

- **Never** modify `.env` directly — always tell user to set in dashboard
- **Never** skip input validation on any route that touches the DB
- **Never** build for iOS — Android only
- **Never** hardcode `API_BASE`, JWT secrets, or MongoDB URI
- **Never** trust client-sent payment amounts — use the due stored on the Payment record
- **Never** log OTPs in production
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
