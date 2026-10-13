'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  role: 'student' | 'admin';
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, confirmPassword: string, role: 'student' | 'admin') => Promise<User>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Set up response interceptor to automatically evict stale tokens on 401
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          setUser(null);
        }
        return Promise.reject(err);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        // Verify token validity by making a request
        const response = await axios.get('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });
        // verify returns NextResponse.json({ message, user: { ... } }) natively in the route, without createResponse wrapper
        setUser(response.data.user || response.data.data?.user);
      }
    } catch (err) {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      const response = await axios.post('/api/auth/login', { email, password });
      // The backend uses createResponse which wraps the payload in { success: true, data: { ... } }
      const { token, user } = response.data.data;
      localStorage.setItem('token', token);
      setUser(user);
      return user;
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.response?.data?.message || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  const register = async (email: string, password: string, confirmPassword: string, role: 'student' | 'admin') => {
    try {
      setError(null);
      const response = await axios.post('/api/auth/register', {
        email,
        password,
        confirmPassword,
        role,
      });
      // The backend uses createResponse which wraps the payload in { success: true, data: { ... } }
      const { token, user } = response.data.data;
      localStorage.setItem('token', token);
      setUser(user);
      return user;
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.response?.data?.message || 'Registration failed';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
    } finally {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, register, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
