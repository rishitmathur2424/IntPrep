// pages/Signup.js - User registration page

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      setError('Please fill in all fields.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/signup', {
        name: form.name,
        email: form.email,
        password: form.password,
      });
      login(res.data.user, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.bgGlow} />
      <div style={styles.container} className="page-enter">
        <div style={styles.logoWrap}>
          <img src="/logo.png" alt="IntPrep" style={styles.logoImg} />
          <span style={styles.logoText}>IntPrep</span>
        </div>

        <div style={styles.card}>
          <h1 style={styles.title}>Create account</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 14 }}>
            Start practicing interviews with AI today
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="John Doe"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="At least 6 characters"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                className="form-input"
                type="password"
                name="confirm"
                value={form.confirm}
                onChange={handleChange}
                placeholder="Repeat your password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
          </form>

          <p style={styles.switchText}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
  },
  bgGlow: {
    position: 'fixed',
    top: '-20%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 600,
    height: 600,
    background: 'radial-gradient(circle, rgba(108,99,255,0.10) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  container: {
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 28,
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logoImg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    objectFit: 'cover',
    boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: 22,
    color: 'var(--text-primary)',
    letterSpacing: '-0.03em',
  },
  card: {
    width: '100%',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-xl)',
    padding: '36px 32px',
    boxShadow: 'var(--shadow-card)',
  },
  title: {
    fontSize: 26,
    marginBottom: 6,
    fontFamily: 'var(--font-display)',
  },
  switchText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
    color: 'var(--text-muted)',
  },
};