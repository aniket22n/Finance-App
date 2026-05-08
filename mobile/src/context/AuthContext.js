import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getMe } from '../services/api';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

// Web platform check
const isWebPlatform = typeof window !== 'undefined';

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

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStoredAuth();
    }, []);

    const loadStoredAuth = async () => {
        try {
            const storedToken = await storage.getItem('authToken');
            if (storedToken) {
                setToken(storedToken);
                const response = await getMe();
                setUser(response.data.user);
            }
        } catch (err) {
            console.log('Auth load failed, clearing token');
            await storage.deleteItem('authToken');
        } finally {
            setLoading(false);
        }
    };

    const login = async (authToken, userData) => {
        await storage.setItem('authToken', authToken);
        setToken(authToken);
        setUser(userData);
    };

    const logout = async () => {
        await storage.deleteItem('authToken');
        setToken(null);
        setUser(null);
    };

    const updateUser = (userData) => {
        setUser(prev => ({ ...prev, ...userData }));
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}
