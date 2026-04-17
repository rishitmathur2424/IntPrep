// context/AuthContext.js
// FIX: On every app load, validates the stored token against the backend.
// If token is missing, expired, or invalid → clears storage and forces login page.
// This ensures users always see login on a fresh browser session or after token expiry.

import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true); // true while validating

  useEffect(() => {
    const validateSession = async () => {
      const savedToken = localStorage.getItem('token');
      const savedUser  = localStorage.getItem('user');

      if (!savedToken || !savedUser) {
        // Nothing stored — show login
        setLoading(false);
        return;
      }

      try {
        // Verify token is still valid against the backend
        await axios.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        // Token valid — restore session
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch (err) {
        // Token expired or invalid — clear everything, force login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    validateSession();
  }, []);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('user',  JSON.stringify(userData));
    localStorage.setItem('token', authToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);