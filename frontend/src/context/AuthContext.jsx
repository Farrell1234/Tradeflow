import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const BASE = import.meta.env.VITE_API_URL || '';

// Shared axios instance with auth header
export const api = axios.create({ baseURL: BASE });

// Attach token to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('tf_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// On 401, clear session (will trigger re-render)
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tf_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(undefined); // undefined = loading
  const [ready, setReady]     = useState(false);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('tf_token');
    if (!token) {
      setUser(null);
      setReady(true);
      return;
    }
    api.get('/auth/me')
      .then(r => setUser(r.data))
      .catch(() => { localStorage.removeItem('tf_token'); setUser(null); })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('tf_token', data.token);
    setUser(data.user);
    return data;
  }, []);

  const signup = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/signup', { email, password });
    localStorage.setItem('tf_token', data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('tf_token');
    setUser(null);
  }, []);

  // Refresh user data (e.g. after subscription change)
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
