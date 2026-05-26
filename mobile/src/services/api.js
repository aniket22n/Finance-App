import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const isWebPlatform = Platform.OS === 'web';
const API_BASE =
    process.env.EXPO_PUBLIC_API_URL ||
    Constants.expoConfig?.extra?.apiBase ||
    'http://localhost:5000/api';

// Storage helper that works on both mobile and web
const storage = {
    async getItem(key) {
        if (isWebPlatform) {
            return localStorage.getItem(key);
        }
        return SecureStore.getItemAsync(key);
    },
    async setItem(key, value) {
        if (isWebPlatform) {
            localStorage.setItem(key, value);
        } else {
            await SecureStore.setItemAsync(key, value);
        }
    },
    async deleteItem(key) {
        if (isWebPlatform) {
            localStorage.removeItem(key);
        } else {
            await SecureStore.deleteItemAsync(key);
        }
    }
};

const api = axios.create({
    baseURL: API_BASE,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use(async (config) => {
    try {
        const token = await storage.getItem('authToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (e) {
        // Ignore storage errors
    }
    return config;
});

// Handle 401 responses
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            await storage.deleteItem('authToken');
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
export const getPlannedWinner   = (groupId) => api.get(`/emi/planned-winner/${groupId}`);

// ── Admin ──
export const getAdminDashboard = () => api.get('/admin/dashboard');
export const getAdminPaymentStats = (groupId, month) => api.get('/admin/payments/stats', { params: { ...(groupId ? { groupId } : {}), ...(month ? { month } : {}) } });
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
export const getAdminPayments = (status) => api.get('/payments/admin/list', { params: status ? { status } : {} });
// statuses: string[] e.g. ['awaiting','verified'] — empty or ['all'] → no filter
export const getAdminPaymentsList = ({ statuses = [], group, month } = {}) => {
    const params = {};
    const active = statuses.filter(s => s !== 'all');
    if (active.length > 0) params.status = active.join(',');
    if (group && group !== 'all') params.group = group;
    if (month && month !== 'all') params.month = month;
    return api.get('/admin/payments', { params });
};
export const getPendingPayments = () => api.get('/payments/pending/all');
export const requestPaymentActionOtp = (id) => api.post(`/payments/${id}/request-action-otp`);
export const adminVerifyPayment = (id, otp) => api.post(`/admin/payments/${id}/verify`, { otp });
export const adminRejectPayment = (id, otp, reason) => api.post(`/admin/payments/${id}/reject`, { otp, reason });
export const adminChangePaymentStatus = (id, newStatus, otp) => api.post(`/admin/payments/${id}/change-status`, { newStatus, otp });
export const sendPaymentReminder = (id) => api.post(`/payments/${id}/remind`);

// ── EMI (admin) ──
// data: { groupId, winnerId, reducedEmi?, emiAmount? }
export const createEmiCycle = (data) => api.post('/emi/cycle', data);
export const configurePot = (groupId, potConfig) =>
    api.post(`/admin/groups/${groupId}/configure-pot`, { potConfig });
export const activateGroup = (groupId) =>
    api.post(`/admin/groups/${groupId}/activate`);

// ── Config ──
export const getPaymentConfig = () => api.get('/admin/config');

// ── Notifications (in-app bell) ──
export const getNotifications        = () => api.get('/notifications');
export const getUnreadCount          = () => api.get('/notifications/unread-count');
export const markNotificationRead    = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.patch('/notifications/read-all');
export const deleteNotification       = (id) => api.delete(`/notifications/${id}`);

export default api;
