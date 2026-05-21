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
export const sendOtp = (phone) => api.post('/auth/send-otp', { phone });
export const verifyOtp = (phone, otp) => api.post('/auth/verify-otp', { phone, otp });
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

// ── EMI ──
export const getEmiCycles = (groupId) => api.get(`/emi/group/${groupId}`);
export const getCurrentCycle = (groupId) => api.get(`/emi/current/${groupId}`);
export const getEligibleMembers = (groupId) => api.get(`/emi/eligible/${groupId}`);

// ── Admin ──
export const getAdminDashboard = () => api.get('/admin/dashboard');
export const getAdminUsers = (params) => api.get('/admin/users', { params });
export const updateUserRole = (userId, role) => api.put(`/admin/users/${userId}/role`, { role });
export const deleteUser = (userId) => api.delete(`/admin/users/${userId}`);
export const sendBulkNotification = (data) => api.post('/admin/notify', data);
export const triggerReminders = () => api.post('/admin/trigger-reminders');
export const getGroupHealth = () => api.get('/admin/analytics/group-health');
export const getRevenueAnalytics = () => api.get('/admin/analytics/revenue');

// ── Payments (admin) ──
export const getAdminPayments = (status) => api.get('/payments/admin/list', { params: status ? { status } : {} });
export const getPendingPayments = () => api.get('/payments/pending/all');
export const verifyPayment = (id, status, notes) => api.put(`/payments/${id}/verify`, { status, notes });

// ── EMI (admin) ──
export const createEmiCycle = (data) => api.post('/emi/cycle', data);

// ── Config ──
export const getPaymentConfig = () => api.get('/admin/config');

export default api;
