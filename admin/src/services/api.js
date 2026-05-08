import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

// Attach admin token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('adminToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('adminToken');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

// Auth
export const adminLogin = (phone, otp) => api.post('/auth/verify-otp', { phone, otp });
export const sendOtp = (phone) => api.post('/auth/send-otp', { phone });

// Dashboard
export const getDashboard = () => api.get('/admin/dashboard');
export const getRevenueAnalytics = () => api.get('/admin/analytics/revenue');

// Groups
export const getGroups = (params) => api.get('/groups', { params });
export const getGroup = (id) => api.get(`/groups/${id}`);
export const createGroup = (data) => api.post('/groups', data);
export const updateGroup = (id, data) => api.put(`/groups/${id}`, data);
export const deleteGroup = (id) => api.delete(`/groups/${id}`);
export const addMember = (groupId, userId) => api.post(`/groups/${groupId}/members`, { userId });
export const removeMember = (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}`);

// Users
export const getUsers = (params) => api.get('/admin/users', { params });
export const updateUserRole = (id, role) => api.put(`/admin/users/${id}/role`, { role });

// Payments
export const getPendingPayments = () => api.get('/payments/pending/all');
export const getGroupPayments = (groupId, params) => api.get(`/payments/group/${groupId}`, { params });
export const verifyPayment = (id, status, notes) => api.put(`/payments/${id}/verify`, { status, notes });

// EMI
export const createEmiCycle = (groupId, winnerId) => api.post('/emi/cycle', { groupId, winnerId });
export const getEmiCycles = (groupId) => api.get(`/emi/group/${groupId}`);
export const getEligibleMembers = (groupId) => api.get(`/emi/eligible/${groupId}`);

// Admin actions
export const sendBulkNotify = (data) => api.post('/admin/notify', data);
export const createBackup = () => api.post('/admin/backup');
export const triggerReminders = () => api.post('/admin/trigger-reminders');

// Monthly Config
export const saveMonthlyConfig = (groupId, monthlyConfig) => api.put(`/groups/${groupId}/monthly-config`, { monthlyConfig });

export default api;
