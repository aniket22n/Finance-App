import axios from 'axios';

// API base resolution:
//  - production: VITE_API_URL (e.g. https://your-api.onrender.com/api)
//  - local dev: '/api' is proxied to the backend by vite.config.js
// Never hardcode an IP.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'authToken';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Drop the token on 401 so the app falls back to the login screen
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      tokenStore.clear();
    }
    return Promise.reject(error);
  }
);

// ── Auth ──
export const checkPhone = (phone) => api.get('/auth/check-phone', { params: { phone } });
export const checkUserType = (phone) => api.post('/auth/check-user-type', { phone });
export const sendOtp = (phone) => api.post('/auth/send-otp', { phone });
export const verifyOtp = (phone, otp) => api.post('/auth/verify-otp', { phone, otp });
export const loginWithPin = (phone, pin) => api.post('/auth/verify-pin', { phone, pin });
export const signup = (data) => api.post('/auth/signup-with-pin', data);
export const setPin = (phone, pin) => api.post('/auth/set-pin', { phone, pin });
export const hasPin = (phone) => api.post('/auth/has-pin', { phone });
export const resetPin = (phone, pin) => api.post('/auth/update-pin', { phone, newPin: pin });
export const forgotPassword = (phone) => api.post('/auth/forgot-password', { phone });
export const updateProfile = (data) => api.put('/auth/profile', data);
export const getMe = () => api.get('/auth/me');

// ── Groups ──
export const getGroups = (params) => api.get('/groups', { params });
export const getGroup = (id) => api.get(`/groups/${id}`);
export const createGroup = (data) => api.post('/groups', data);
export const updateGroup = (id, data) => api.put(`/groups/${id}`, data);
export const deleteGroup = (id) => api.delete(`/groups/${id}`);
export const addMember = (groupId, userId) => api.post(`/groups/${groupId}/members`, { userId });
export const removeMember = (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}`);

// ── Payments ──
export const initiatePayment = (data) => api.post('/payments/initiate', data);
export const getGroupPayments = (groupId, params) => api.get(`/payments/group/${groupId}`, { params });
export const getUserPayments = (userId) => api.get(`/payments/user/${userId}`);
export const getMyPendingPayments = () => api.get('/payments/my/pending');

// ── EMI ──
export const getEmiCycles = (groupId) => api.get(`/emi/group/${groupId}`);
export const getCurrentCycle = (groupId) => api.get(`/emi/current/${groupId}`);
export const getEligibleMembers = (groupId) => api.get(`/emi/eligible/${groupId}`);
export const getPlannedWinner = (groupId) => api.get(`/emi/planned-winner/${groupId}`);

// ── Admin ──
export const getAdminDashboard = () => api.get('/admin/dashboard');
export const getAdminPaymentStats = (groupId, month) =>
  api.get('/admin/payments/stats', { params: { ...(groupId ? { groupId } : {}), ...(month ? { month } : {}) } });
export const getAdminUsers = (params) => api.get('/admin/users', { params });
export const updateUserRole = (userId, role) => api.put(`/admin/users/${userId}/role`, { role });
export const deleteUser = (userId) => api.delete(`/admin/users/${userId}`);
export const sendBulkNotification = (data) => api.post('/admin/notify', data);
export const triggerReminders = () => api.post('/admin/trigger-reminders');
export const getGroupHealth = () => api.get('/admin/analytics/group-health');
export const getRevenueAnalytics = () => api.get('/admin/analytics/revenue');
export const getAccountRequests = (status) => api.get('/admin/account-requests', { params: status ? { status } : {} });
export const getPendingAccountRequests = () => api.get('/admin/account-requests/pending');
export const approveAccountRequest = (requestId) => api.post(`/admin/account-requests/${requestId}/approve`);
export const rejectAccountRequest = (requestId, reason) => api.post(`/admin/account-requests/${requestId}/reject`, { reason });

// ── Payments (admin) ──
// statuses: string[] e.g. ['awaiting','verified'] — empty or ['all'] → no filter
export const getAdminPaymentsList = ({ statuses = [], group, month } = {}) => {
  const params = {};
  const active = statuses.filter((s) => s !== 'all');
  if (active.length > 0) params.status = active.join(',');
  if (group && group !== 'all') params.group = group;
  if (month && month !== 'all') params.month = month;
  return api.get('/admin/payments', { params });
};
export const requestPaymentActionOtp = (id) => api.post(`/payments/${id}/request-action-otp`);
export const adminVerifyPayment = (id, otp) => api.post(`/admin/payments/${id}/verify`, { otp });
export const adminRejectPayment = (id, otp, reason) => api.post(`/admin/payments/${id}/reject`, { otp, reason });
export const adminChangePaymentStatus = (id, newStatus, otp, reason) =>
  api.post(`/admin/payments/${id}/change-status`, { newStatus, otp, ...(reason ? { reason } : {}) });
export const sendPaymentReminder = (id) => api.post(`/payments/${id}/remind`);

// ── EMI (admin) ──
export const createEmiCycle = (data) => api.post('/emi/cycle', data);
export const configurePot = (groupId, potConfig) => api.post(`/admin/groups/${groupId}/configure-pot`, { potConfig });
export const activateGroup = (groupId) => api.post(`/admin/groups/${groupId}/activate`);

// ── Config ──
export const getPaymentConfig = () => api.get('/admin/config');

// ── Notifications (in-app bell) ──
export const getNotifications = () => api.get('/notifications');
export const getUnreadCount = () => api.get('/notifications/unread-count');
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.patch('/notifications/read-all');
export const deleteNotification = (id) => api.delete(`/notifications/${id}`);

// Pulls the auth token + user out of any of the shapes the backend may return.
export const extractAuth = (data) => {
  const token = data?.token || data?.accessToken || data?.jwt || data?.data?.token;
  const user = data?.user || data?.data?.user || data?.profile || null;
  return { token, user };
};

// Normalizes an axios error into a readable string.
export const errMsg = (e) =>
  e?.response?.data?.message ||
  e?.response?.data?.error ||
  e?.message ||
  'Something went wrong';

export default api;
