import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getMe, tokenStore } from '../services/api';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(tokenStore.get());
  const [loading, setLoading] = useState(true);

  const loadStoredAuth = useCallback(async () => {
    const stored = tokenStore.get();
    if (!stored) {
      setLoading(false);
      return;
    }
    try {
      setToken(stored);
      const res = await getMe();
      setUser(res.data.user || res.data);
    } catch {
      tokenStore.clear();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  const login = (authToken, userData) => {
    tokenStore.set(authToken);
    setToken(authToken);
    setUser(userData);
  };

  const logout = () => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  };

  const updateUser = (patch) => setUser((prev) => ({ ...prev, ...patch }));

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, token, loading, isAdmin, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
