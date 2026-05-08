import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Use environment variable for API URL or default to localhost
// Note: For web/browser testing, always use localhost
const isWebPlatform = typeof window !== 'undefined';
const API_BASE = process.env.EXPO_PUBLIC_API_URL ||
    (isWebPlatform ? 'http://localhost:5000/api' :
     (__DEV__ ? 'http://localhost:5000/api' : 'https://android-app-js8f.onrender.com/api'));

console.log('API_BASE:', API_BASE, 'isWeb:', isWebPlatform);

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
export const sendOtp = (phone) => api.post('/auth/send-otp', { phone });
export const verifyOtp = (phone, otp) => api.post('/auth/verify-otp', { phone, otp });
export const updateProfile = (data) => api.put('/auth/profile', data);
export const getMe = () => api.get('/auth/me');

// ── Groups ──
export const getGroups = (params) => api.get('/groups', { params });
export const getGroup = (id) => api.get(`/groups/${id}`);
export const createGroup = (data) => api.post('/groups', data);
export const updateGroup = (id, data) => api.put(`/groups/${id}`, data);
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

// ── Config ──
export const getPaymentConfig = () => api.get('/admin/config');

export default api;
