// utils/api.js - Axios instance
// Uses REACT_APP_API_URL env var so it works both locally and in production.
// Set REACT_APP_API_URL=https://your-backend.railway.app in production .env

import axios from 'axios';

const api = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL || ''}/api`,
  timeout: 60000, // 60s — AI question generation can take a moment
});

// Attach JWT token automatically to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — clear session, redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;