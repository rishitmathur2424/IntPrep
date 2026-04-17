// pages/History.js - User's past interview sessions

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/user/history')
      .then((res) => setSessions(res.data.sessions || []))
      .catch(() => setError('Failed to load history.'))
      .finally(() => setLoading(false));
  }, []);

  const scoreColor = (s) => {
    if (!s) return 'var(--text-muted)';
    return s >= 7 ? 'var(--success)' : s >= 4 ? 'var(--warning)' : 'var(--danger)';
  };

  const statusBadge = (status) => {
    const map = {
      completed: { bg: 'rgba(52,211,153,0.1)', color: 'var(--success)', border: 'rgba(52,211,153,0.3)', label: 'Completed' },
      active: { bg: 'rgba(251,191,36,0.1)', color: 'var(--warning)', border: 'rgba(251,191,36,0.3)', label: 'In Progress' },
      pending: { bg: 'rgba(148,163,184,0.1)', color: 'var(--text-muted)', border: 'rgba(148,163,184,0.2)', label: 'Pending' },
    };
    const style = map[status] || map.pending;
    return (
      <span style={{
        background: style.bg, color: style.color,
        border: `1px solid ${style.border}`, borderRadius: 99,
        padding: '3px 10px', fontSize: 11,
        fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.04em',
      }}>
        {style.label}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={styles.page} className="page-enter">
      <div className="container" style={{ paddingTop: 48, paddingBottom: 60 }}>
        <div style={styles.header}>
          <div>
            <p style={styles.tagline}>Your Progress</p>
            <h1 style={styles.title}>Interview History</h1>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard')}>
            + New Interview
          </button>
        </div>

        {loading && (
          <div style={styles.centered}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
            <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Loading sessions...</p>
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        {!loading && sessions.length === 0 && (
          <div style={styles.empty}>
            <span style={{ fontSize: 48 }}>🎤</span>
            <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 16 }}>No interviews yet</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 14 }}>
              Start your first mock interview to see results here.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 20 }}
              onClick={() => navigate('/dashboard')}
            >
              Start Now →
            </button>
          </div>
        )}

        {sessions.length > 0 && (
          <div style={styles.list}>
            {sessions.map((session) => (
              <div key={session.id} style={styles.row}>
                {/* Mode icon */}
                <div style={styles.modeIcon}>
                  {session.mode === 'resume' ? '📄' : '🎯'}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={styles.rowTop}>
                    <span style={styles.roleName}>{session.target_role || 'General'}</span>
                    {statusBadge(session.status)}
                  </div>
                  <div style={styles.rowMeta}>
                    <span>{session.mode === 'resume' ? 'Resume-based' : 'Role-based'}</span>
                    <span>·</span>
                    <span>{formatDate(session.created_at)}</span>
                  </div>
                </div>

                {/* Score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  {session.overall_score != null ? (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 800,
                        fontSize: 22,
                        color: scoreColor(session.overall_score),
                      }}>
                        {Number(session.overall_score).toFixed(1)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>/ 10</div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats summary */}
        {sessions.length > 0 && (
          <div style={styles.statsRow}>
            {[
              { label: 'Total Sessions', value: sessions.length },
              {
                label: 'Completed',
                value: sessions.filter((s) => s.status === 'completed').length,
              },
              {
                label: 'Avg. Score',
                value: (() => {
                  const scored = sessions.filter((s) => s.overall_score != null);
                  if (!scored.length) return '—';
                  return (scored.reduce((a, s) => a + Number(s.overall_score), 0) / scored.length).toFixed(1);
                })(),
              },
              {
                label: 'Best Score',
                value: (() => {
                  const scored = sessions.filter((s) => s.overall_score != null);
                  if (!scored.length) return '—';
                  return Math.max(...scored.map((s) => Number(s.overall_score))).toFixed(1);
                })(),
              },
            ].map(({ label, value }) => (
              <div key={label} style={styles.statCard}>
                <div style={styles.statValue}>{value}</div>
                <div style={styles.statLabel}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: 'calc(100vh - 64px)' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 36,
  },
  tagline: {
    color: 'var(--accent-secondary)', fontFamily: 'var(--font-display)',
    fontWeight: 600, fontSize: 13, letterSpacing: '0.06em',
    textTransform: 'uppercase', marginBottom: 6,
  },
  title: { fontSize: 34, fontFamily: 'var(--font-display)' },
  centered: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '80px 0',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '80px 24px', textAlign: 'center',
    background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
    border: '1px solid var(--border-subtle)',
  },
  list: {
    display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36,
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 18,
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)', padding: '18px 24px',
    transition: 'border-color 0.2s ease',
  },
  modeIcon: {
    width: 44, height: 44, borderRadius: 10,
    background: 'var(--bg-elevated)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 20,
    flexShrink: 0,
  },
  rowTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 },
  roleName: {
    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
    color: 'var(--text-primary)',
  },
  rowMeta: {
    display: 'flex', gap: 8, color: 'var(--text-muted)', fontSize: 12,
  },
  statsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
    marginTop: 8,
  },
  statCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)', padding: '20px',
    textAlign: 'center',
  },
  statValue: {
    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28,
    color: 'var(--text-primary)', marginBottom: 4,
  },
  statLabel: {
    fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-display)',
    fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
  },
};
