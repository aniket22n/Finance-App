import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Spinner from './components/Spinner';

import LoginPage from './pages/auth/LoginPage';
import SignUpPage from './pages/auth/SignUpPage';
import SignUpOTPPage from './pages/auth/SignUpOTPPage';
import SetPINPage from './pages/auth/SetPINPage';
import OTPVerificationPage from './pages/auth/OTPVerificationPage';
import ForgotPINPage from './pages/auth/ForgotPINPage';
import ResetPINOTPPage from './pages/auth/ResetPINOTPPage';
import ResetPINPage from './pages/auth/ResetPINPage';
import SignupPendingPage from './pages/auth/SignupPendingPage';
import HomePage from './pages/HomePage';
import GroupsPage from './pages/GroupsPage';
import GroupDetailPage from './pages/GroupDetailPage';
import PaymentPage from './pages/PaymentPage';
import PaymentsHistoryPage from './pages/PaymentsHistoryPage';
import PaymentDetailPage from './pages/PaymentDetailPage';
import ProfilePage from './pages/ProfilePage';

import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminGroupsPage from './pages/admin/AdminGroupsPage';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import AdminPaymentDetailPage from './pages/admin/AdminPaymentDetailPage';
import AdminPaymentOTPPage from './pages/admin/AdminPaymentOTPPage';
import AdminAccountRequestsPage from './pages/admin/AdminAccountRequestsPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminControlsPage from './pages/admin/AdminControlsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminPOTWinnerConfigPage from './pages/admin/AdminPOTWinnerConfigPage';
import AdminAddMembersPage from './pages/admin/AdminAddMembersPage';

// Members and admins share one app; the landing route depends on role.
function RoleHome() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Navigate to="/admin" replace /> : <HomePage />;
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <Spinner full />;

  const member = (el) => (
    <ProtectedRoute>
      <Layout>{el}</Layout>
    </ProtectedRoute>
  );
  const admin = (el) => (
    <ProtectedRoute adminOnly>
      <Layout>{el}</Layout>
    </ProtectedRoute>
  );

  return (
    <Routes>
      {/* Auth flow (unauthenticated) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/signup-otp" element={<SignUpOTPPage />} />
      <Route path="/set-pin" element={<SetPINPage />} />
      <Route path="/otp" element={<OTPVerificationPage />} />
      <Route path="/forgot-pin" element={<ForgotPINPage />} />
      <Route path="/reset-pin-otp" element={<ResetPINOTPPage />} />
      <Route path="/reset-pin" element={<ResetPINPage />} />
      <Route path="/signup-pending" element={<SignupPendingPage />} />

      {/* Member */}
      <Route path="/" element={member(<RoleHome />)} />
      <Route path="/groups" element={member(<GroupsPage />)} />
      <Route path="/groups/:id" element={member(<GroupDetailPage />)} />
      <Route path="/pay/:groupId" element={member(<PaymentPage />)} />
      <Route path="/payments" element={member(<PaymentsHistoryPage />)} />
      <Route path="/payments/:id" element={member(<PaymentDetailPage />)} />
      <Route path="/profile" element={member(<ProfilePage />)} />

      {/* Admin */}
      <Route path="/admin" element={admin(<AdminDashboardPage />)} />
      <Route path="/admin/groups" element={admin(<AdminGroupsPage />)} />
      <Route path="/admin/groups/:id" element={admin(<GroupDetailPage />)} />
      <Route path="/admin/groups/:id/add-members" element={admin(<AdminAddMembersPage />)} />
      <Route path="/admin/groups/:id/pot" element={admin(<AdminPOTWinnerConfigPage />)} />
      <Route path="/admin/payments" element={admin(<AdminPaymentsPage />)} />
      <Route path="/admin/payments/:id" element={admin(<AdminPaymentDetailPage />)} />
      <Route path="/admin/payments/:id/otp" element={admin(<AdminPaymentOTPPage />)} />
      <Route path="/admin/requests" element={admin(<AdminAccountRequestsPage />)} />
      <Route path="/admin/analytics" element={admin(<AdminAnalyticsPage />)} />
      <Route path="/admin/controls" element={admin(<AdminControlsPage />)} />
      <Route path="/admin/users" element={admin(<AdminUsersPage />)} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
