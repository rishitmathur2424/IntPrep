// pages/Dashboard.js
// FIX: Shows the real backend error message so you can actually debug issues.
// Token sent as form field (not header) to avoid FastAPI multipart conflict.
// No manual Content-Type header — browser sets it with boundary automatically.

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const ROLES = [
  'Software Engineer',
  'Data Scientist',
  'UI/UX Designer',
  'Product Manager',
  'Backend Developer',
  'Frontend Developer',
  'Full Stack Developer',
  'DevOps Engineer',
  'Machine Learning Engineer',
  'Data Analyst',
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  // Resume mode
  const [selectedFile,  setSelectedFile]  = useState(null);
  const [resumeRole,    setResumeRole]    = useState('Software Engineer');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError,   setUploadError]   = useState('');
  const [isDragging,    setIsDragging]    = useState(false);
  const fileInputRef = useRef();

  // Role mode
  const [selectedRole, setSelectedRole] = useState('Software Engineer');
  const [customRole,   setCustomRole]   = useState('');
  const [roleLoading,  setRoleLoading]  = useState(false);
  const [roleError,    setRoleError]    = useState('');

  // ── File validation ──────────────────────────────────────────────────────────
  const validateFile = (file) => {
    if (!file) return false;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'doc'].includes(ext)) {
      setUploadError('Please upload a PDF or DOCX file.');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size must be under 10MB.');
      return false;
    }
    return true;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
      setUploadError('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
      setUploadError('');
    }
  };

  // ── Resume start ─────────────────────────────────────────────────────────────
  const handleResumeStart = async () => {
    if (!selectedFile) {
      setUploadError('Please select a resume file first.');
      return;
    }

    setUploadLoading(true);
    setUploadError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // IMPORTANT: Do NOT set Content-Type manually.
      // Axios + browser will set multipart/form-data with the correct boundary.
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('target_role', resumeRole);
      formData.append('token', token); // token as form field — FastAPI multipart fix

      const res = await api.post('/session/start-resume', formData);
      // ↑ No headers option — let axios handle Content-Type automatically

      navigate('/interview', {
        state: {
          sessionId: res.data.session_id,
          questions: res.data.questions,
          skills:    [],
          mode:      'resume',
          role:      resumeRole,
        },
      });

    } catch (err) {
      // Show the REAL error from the backend, not a generic message
      const detail = err.response?.data?.detail;
      const status = err.response?.status;

      if (detail) {
        setUploadError(`Error ${status}: ${detail}`);
      } else if (err.message) {
        setUploadError(`Request failed: ${err.message}`);
      } else {
        setUploadError('Unknown error. Check the backend terminal for details.');
      }

      console.error('[Resume Upload Error]', {
        status,
        detail,
        fullError: err.response?.data,
      });
    } finally {
      setUploadLoading(false);
    }
  };

  // ── Role start ───────────────────────────────────────────────────────────────
  const handleRoleStart = async () => {
    const role = customRole.trim() || selectedRole;
    setRoleLoading(true);
    setRoleError('');

    try {
      const res = await api.post('/session/start-role', { target_role: role });

      navigate('/interview', {
        state: {
          sessionId: res.data.session_id,
          questions: res.data.questions,
          skills:    [],
          mode:      'role',
          role,
        },
      });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setRoleError(detail || `Failed: ${err.message}`);
      console.error('[Role Start Error]', err.response?.data);
    } finally {
      setRoleLoading(false);
    }
  };

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={styles.page} className="page-enter">
      <div style={styles.bgGlow} />

      <div className="container" style={{ paddingTop: 48, paddingBottom: 60 }}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <p style={styles.greeting}>{greeting}, {user?.name?.split(' ')[0]} 👋</p>
            <h1 style={styles.title}>Ready to Practice?</h1>
            <p style={styles.subtitle}>Choose how you'd like to start your mock interview session.</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
            📋 View History
          </button>
        </div>

        {/* Panels */}
        <div style={styles.panels}>

          {/* ── Panel A: Upload Resume ── */}
          <div style={styles.panel}>
            <div style={styles.panelBadge}>
              <span>📄</span>
              <span style={styles.panelLabel}>Option A</span>
            </div>
            <h2 style={styles.panelTitle}>Upload Resume</h2>
            <p style={styles.panelDesc}>
              We'll read your resume and generate questions specific to your projects, skills, and experience.
            </p>

            {/* Drop zone */}
            <div
              style={{
                ...styles.dropZone,
                ...(isDragging   ? styles.dropZoneDragging : {}),
                ...(selectedFile ? styles.dropZoneActive   : {}),
              }}
              onClick={() => fileInputRef.current.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              {selectedFile ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32 }}>✅</div>
                  <p style={{ color: 'var(--success)', fontWeight: 600, fontSize: 14, marginTop: 8 }}>{selectedFile.name}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                    {(selectedFile.size / 1024).toFixed(0)} KB · Click to change
                  </p>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32 }}>📎</div>
                  <p style={{ color: 'var(--text-secondary)', fontWeight: 500, marginTop: 8 }}>Drop your resume here</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>PDF or DOCX · Max 10MB · Click to browse</p>
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginTop: 4 }}>
              <label className="form-label">Target Role</label>
              <select className="form-select" value={resumeRole} onChange={(e) => setResumeRole(e.target.value)}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Error shows real backend message */}
            {uploadError && (
              <div className="alert alert-error" style={{ wordBreak: 'break-word', fontSize: 13 }}>
                ⚠ {uploadError}
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleResumeStart}
              disabled={uploadLoading || !selectedFile}
            >
              {uploadLoading
                ? <><span className="spinner" /> Analyzing Resume...</>
                : '🚀 Start Interview'}
            </button>
          </div>

          {/* Divider */}
          <div style={styles.divider}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>or</span>
            <div style={styles.dividerLine} />
          </div>

          {/* ── Panel B: Role-based ── */}
          <div style={styles.panel}>
            <div style={styles.panelBadge}>
              <span>🎯</span>
              <span style={styles.panelLabel}>Option B</span>
            </div>
            <h2 style={styles.panelTitle}>Start Without Resume</h2>
            <p style={styles.panelDesc}>
              Pick your target role and the AI will generate relevant technical and behavioral questions.
            </p>

            <div className="form-group">
              <label className="form-label">Select Role</label>
              <select className="form-select" value={selectedRole} onChange={(e) => { setSelectedRole(e.target.value); setCustomRole(''); }}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div style={styles.orRow}>
              <div style={styles.smallLine} />
              <span style={{ color: 'var(--text-muted)', fontSize: 12, padding: '0 10px', whiteSpace: 'nowrap' }}>or enter custom role</span>
              <div style={styles.smallLine} />
            </div>

            <div className="form-group">
              <input
                className="form-input"
                type="text"
                placeholder="e.g. iOS Developer, Embedded Engineer..."
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRoleStart()}
              />
            </div>

            <div style={styles.chips}>
              {['Software Engineer', 'Data Scientist', 'UI/UX Designer'].map((r) => (
                <button
                  key={r}
                  style={{ ...styles.chip, ...(selectedRole === r && !customRole ? styles.chipActive : {}) }}
                  onClick={() => { setSelectedRole(r); setCustomRole(''); }}
                >
                  {r}
                </button>
              ))}
            </div>

            {roleError && (
              <div className="alert alert-error" style={{ wordBreak: 'break-word', fontSize: 13 }}>
                ⚠ {roleError}
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}
              onClick={handleRoleStart}
              disabled={roleLoading}
            >
              {roleLoading
                ? <><span className="spinner" /> Generating Questions...</>
                : '🎤 Start Interview'}
            </button>
          </div>
        </div>

        {/* ── Feature section — Linear/Stripe style ── */}
        <div style={styles.featuresSection}>
          <p style={styles.featuresEyebrow}>Everything you need to prepare</p>
          <div style={styles.featuresGrid}>
            {[
              { title: 'Role-Based Questions',     desc: 'Tailored question sets for any job title or industry.' },
              { title: 'AI Feedback Analysis',     desc: 'Intelligent evaluation of your answers, not generic tips.' },
              { title: 'Resume-Based Insights',    desc: 'Questions generated from your actual projects and skills.' },
              { title: 'Quick 10–15 Min Sessions', desc: 'Focused practice that fits into any schedule.' },
              { title: 'Unlimited Practice',       desc: 'No caps, no cooldowns. Practice as many times as you need.' },
              { title: 'Performance Tracking',     desc: 'Monitor your scores and improvement across all sessions.' },
            ].map((f, i) => (
              <div
                key={f.title}
                style={styles.featureItem}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.background  = 'rgba(255,255,255,0.02)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.background  = 'transparent';
                }}
              >
                <span style={styles.featureIndex}>0{i + 1}</span>
                <div>
                  <p style={styles.featureTitle}>{f.title}</p>
                  <p style={styles.featureDesc}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page:       { minHeight: 'calc(100vh - 64px)', position: 'relative' },
  bgGlow:     { position: 'fixed', top: 0, right: 0, width: 420, height: 420, background: 'radial-gradient(circle, rgba(108,99,255,0.07) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 },
  greeting:   { color: 'var(--accent-secondary)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, letterSpacing: '0.04em', marginBottom: 6 },
  title:      { fontSize: 36, marginBottom: 8, fontFamily: 'var(--font-display)' },
  subtitle:   { color: 'var(--text-secondary)', fontSize: 15 },
  panels:     { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0, alignItems: 'stretch', marginBottom: 40, minWidth: 0, width: '100%' },
  panel:      { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '32px', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, overflow: 'hidden' },
  panelBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg-elevated)', borderRadius: 99, border: '1px solid var(--border-subtle)', width: 'fit-content' },
  panelLabel: { fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' },
  panelTitle: { fontSize: 22, fontFamily: 'var(--font-display)', marginBottom: 0 },
  panelDesc:  { fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 },
  dropZone:         { border: '2px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '28px 16px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', minHeight: 130 },
  dropZoneDragging: { borderColor: 'var(--accent-primary)', background: 'rgba(108,99,255,0.08)' },
  dropZoneActive:   { borderColor: 'var(--success)', background: 'rgba(52,211,153,0.05)' },
  divider:      { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', gap: 12 },
  dividerLine:  { flex: 1, width: 1, background: 'var(--border-subtle)' },
  dividerText:  { color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-display)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  orRow:        { display: 'flex', alignItems: 'center', margin: '-4px 0' },
  smallLine:    { flex: 1, height: 1, background: 'var(--border-subtle)' },
  chips:        { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip:         { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 99, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', transition: 'all 0.15s ease' },
  chipActive:   { background: 'rgba(108,99,255,0.15)', borderColor: 'var(--accent-primary)', color: 'var(--accent-secondary)' },
  // Feature section
  featuresSection: {
    marginTop: 56,
    paddingTop: 48,
    borderTop: '1px solid var(--border-subtle)',
  },
  featuresEyebrow: {
    fontFamily: 'var(--font-display)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: 24,
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 0,
    width: '100%',
    minWidth: 0,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    padding: '20px 24px',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-md)',
    transition: 'all 0.18s ease',
    cursor: 'default',
  },
  featureIndex: {
    fontFamily: 'var(--font-display)',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    opacity: 0.4,
    letterSpacing: '0.04em',
    marginTop: 2,
    flexShrink: 0,
    minWidth: 20,
  },
  featureTitle: {
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: 14,
    color: 'var(--text-primary)',
    letterSpacing: '-0.01em',
    marginBottom: 5,
  },
  featureDesc: {
    fontSize: 13,
    color: 'var(--text-muted)',
    lineHeight: 1.6,
    fontWeight: 400,
  },
};