// components/Navbar.js

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.inner}>
        
        {/* Logo */}
        <div style={styles.logo} onClick={() => navigate('/dashboard')}>
          <img src="/logo.png" alt="IntPrep" style={styles.logoImg} />
          
          {/* Styled Text */}
          <span style={styles.logoText}>
            Int<span style={styles.prepText}>Prep</span>
          </span>
        </div>

        {user && (
          <div style={styles.right}>
            <button onClick={() => navigate('/history')} className="btn btn-ghost btn-sm">
              History
            </button>

            <div style={styles.userChip}>
              <div style={styles.avatar}>
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <span style={styles.userName}>{user.name}</span>
            </div>

            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(10, 10, 15, 0.9)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    padding: '0 28px',
    width: '100%',
    boxSizing: 'border-box',

    // 🔥 Purple glow effect
    boxShadow: '0 6px 25px rgba(139, 92, 246, 0.15)',
  },

  inner: {
    maxWidth: 1200,
    margin: '0 auto',
    height: 70, // slightly taller
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },

  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    userSelect: 'none',
  },

  logoImg: {
    width: 34,   // ⬆️ increased
    height: 34,
    borderRadius: 8,
    objectFit: 'cover',
  },

  logoText: {
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 700,
    fontSize: 22, // ⬆️ bigger text
    color: '#f5f3ff',
    letterSpacing: '-0.02em',
  },

  // ✨ Purple "Prep"
  prepText: {
    background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },

  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },

  userChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    background: 'var(--bg-elevated)',
    borderRadius: 99,
    border: '1px solid var(--border-subtle)',
  },

  avatar: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
  },

  userName: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
};