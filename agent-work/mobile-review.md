# Mobile App Review
Generated: 2025-05-14

## Screens Reviewed
- HomeScreen.jsx ✅
- LoginScreen.jsx
- GroupListScreen.jsx
- GroupDetailScreen.jsx
- PaymentScreen.jsx
- ProfileScreen.jsx

## ✅ What's Good
- Clean dark theme (#1a1a2e)
- Pull-to-refresh implemented
- useFocusEffect for real-time updates
- Good use of Ionicons
- Avatar component with initials fallback

## ⚠️ Issues

### HomeScreen
1. `pendingCount` is just `activeGroups.length` - wrong logic
2. No pull-to-refresh indicator during load
3. "Total Pot" shows sum of all pots, not user's share

### GroupDetail
1. No "Next Draw" section (eligible members)
2. No draw history timeline
3. Progress ring - percentage unclear

### Payment
1. Only UPI deeplink - no confirmation
2. No payment method selection (UPI/Bank/Cash)
3. No receipt upload option

### General
1. No offline support
2. No error boundaries
3. Hardcoded colors instead of theme variables

## Recommendations
1. Show next EMI due date on home screen
2. Add "next eligible" members in group detail
3. Add payment method selection
4. Add success/error modals after payment
5. Add skeleton loading states