// pages/Report.js - Full interview report with AI-generated feedback per question

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Report() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { sessionId, report, answeredQuestions = [] } = location.state || {};
  const [expandedIdx, setExpandedIdx] = useState(null);

  if (!report) { navigate('/dashboard'); return null; }

  const { overall_score, strengths, weaknesses, summary, total_questions } = report;

  const scoreColor = s => {
    if (s === null || s === undefined) return 'var(--text-muted)';
    if (s >= 7)  return 'var(--success)';
    if (s >= 4)  return 'var(--warning)';
    return 'var(--danger)';
  };
  const scoreLabel = s => s >= 8 ? 'Excellent' : s >= 6 ? 'Good' : s >= 4 ? 'Fair' : 'Poor';

  // SVG donut
  const circumference = 2 * Math.PI * 54;
  const filled = ((overall_score || 0) / 10) * circumference;

  return (
    <div style={styles.page} className="page-enter">
      <div style={styles.bgGlow} />

      <div className="container" style={{ paddingTop: 48, paddingBottom: 60 }}>

        {/* Header */}
        <div style={styles.header}>
          <div>
            <p style={styles.tagline}>Interview Complete</p>
            <h1 style={styles.title}>Your Performance Report</h1>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}>📋 History</button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard')}>🔄 Try Again</button>
          </div>
        </div>

        {/* ── Overall Summary ── */}
        <div style={styles.summaryGrid}>
          {/* Donut */}
          <div style={styles.scorePanel}>
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="54" fill="none" stroke="var(--bg-elevated)" strokeWidth="12" />
              <circle
                cx="70" cy="70" r="54" fill="none"
                stroke={scoreColor(overall_score)}
                strokeWidth="12"
                strokeDasharray={`${filled} ${circumference - filled}`}
                strokeDashoffset={circumference * 0.25}
                strokeLinecap="round"
              />
              <text x="70" y="65" textAnchor="middle" fill="var(--text-primary)"
                fontFamily="var(--font-display)" fontWeight="800" fontSize="26">
                {(overall_score || 0).toFixed(1)}
              </text>
              <text x="70" y="84" textAnchor="middle" fill="var(--text-muted)" fontSize="11">out of 10</text>
            </svg>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 800, color: scoreColor(overall_score) }}>
                {scoreLabel(overall_score)}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                {total_questions} questions answered
              </div>
            </div>
          </div>

          {/* Summary text */}
          <div style={styles.summaryPanel}>
            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 10 }}>Overall Assessment</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
              {summary}
            </p>
            <div style={styles.swGrid}>
              <div style={styles.swCard}>
                <span style={{ fontSize: 18 }}>💪</span>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, color: 'var(--success)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>
                    STRENGTHS
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {strengths || 'Practice more to develop clear strengths.'}
                  </p>
                </div>
              </div>
              <div style={styles.swCard}>
                <span style={{ fontSize: 18 }}>📈</span>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, color: 'var(--warning)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>
                    AREAS TO IMPROVE
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {weaknesses || 'No major weaknesses identified.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Per-question breakdown ── */}
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 20 }}>
          Question-by-Question Breakdown
        </h2>

        <div style={styles.questionList}>
          {answeredQuestions.map((item, idx) => {
            const { question, answer, result } = item;
            const s = result?.scores || {};
            const overall = s.overall ?? 0;
            const isExpanded = expandedIdx === idx;

            return (
              <div key={idx} style={styles.qCard}>
                {/* Header row — always visible */}
                <div
                  style={styles.qHeader}
                  onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                >
                  <div style={styles.qNumber}>Q{idx + 1}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={styles.qCategoryTag}>{question.category}</span>
                    <p style={styles.qText}>{question.question_text}</p>
                  </div>

                  {/* Score circle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: '50%',
                        border: `2.5px solid ${scoreColor(overall)}`,
                        color: scoreColor(overall),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
                      }}>
                        {overall.toFixed(1)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'var(--font-display)' }}>
                        /10
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 18, userSelect: 'none' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Score bars — always visible */}
                <div style={styles.miniBars}>
                  {[
                    { label: 'Relevance',     val: s.relevance },
                    { label: 'Depth',         val: s.technical },
                    { label: 'Confidence',    val: s.confidence },
                    { label: 'Communication', val: s.communication },
                  ].map(({ label, val = 0 }) => (
                    <div key={label} style={styles.miniBar}>
                      <span style={styles.miniLabel}>{label}</span>
                      <div style={styles.miniTrack}>
                        <div style={{
                          ...styles.miniFill,
                          width: `${(val / 10) * 100}%`,
                          background: scoreColor(val),
                          opacity: val === 0 ? 0.3 : 1,
                        }} />
                      </div>
                      <span style={{ ...styles.miniVal, color: scoreColor(val) }}>
                        {val.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Expanded section — AI feedback + answer + ideal */}
                {isExpanded && (
                  <div style={styles.expandedSection} className="page-enter">

                    {/* AI Feedback */}
                    {result?.feedback && (
                      <div style={styles.feedbackBlock}>
                        <p style={styles.blockLabel}>🤖 AI Feedback</p>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                          {result.feedback}
                        </p>
                      </div>
                    )}

                    <div style={styles.twoCol}>
                      {/* Strengths */}
                      {result?.strengths && (
                        <div style={styles.strengthBlock}>
                          <p style={styles.blockLabel}>💪 What You Did Well</p>
                          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {result.strengths}
                          </p>
                        </div>
                      )}

                      {/* Improvements */}
                      {result?.improvements && (
                        <div style={styles.improveBlock}>
                          <p style={styles.blockLabel}>📌 What Was Missing</p>
                          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {result.improvements}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Your answer */}
                    <div style={styles.answerBlock}>
                      <p style={styles.blockLabel}>Your Answer</p>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, fontStyle: answer ? 'normal' : 'italic' }}>
                        {answer || '(No answer recorded)'}
                      </p>
                    </div>

                    {/* Ideal answer */}
                    <div style={styles.idealBlock}>
                      <p style={styles.blockLabel}>💡 Ideal Answer</p>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        {question.ideal_answer}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Score summary table ── */}
        <div style={styles.scoreSummary}>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 16 }}>Score Summary</h3>
          <div style={styles.scoreGrid}>
            {[
              { label: 'Relevance',     key: 'relevance' },
              { label: 'Depth',         key: 'technical' },
              { label: 'Confidence',    key: 'confidence' },
              { label: 'Communication', key: 'communication' },
            ].map(({ label, key }) => {
              const avg = answeredQuestions.length > 0
                ? answeredQuestions.reduce((sum, q) => sum + (q.result?.scores?.[key] || 0), 0) / answeredQuestions.length
                : 0;
              return (
                <div key={key} style={styles.scoreCard}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    border: `2.5px solid ${scoreColor(avg)}`,
                    color: scoreColor(avg),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17,
                    margin: '0 auto 10px',
                  }}>
                    {avg.toFixed(1)}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 600, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 40 }}>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/dashboard')}>
            🚀 Practice Again
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/history')}>
            📋 View All Sessions
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: 'calc(100vh - 64px)', position: 'relative' },
  bgGlow: {
    position: 'fixed', top: 0, right: 0,
    width: 380, height: 380,
    background: 'radial-gradient(circle, rgba(108,99,255,0.07) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 },
  tagline: { color: 'var(--accent-secondary)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 },
  title: { fontSize: 34, fontFamily: 'var(--font-display)' },
  summaryGrid: {
    display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 32, marginBottom: 40,
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-xl)', padding: 32,
  },
  scorePanel: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
    paddingRight: 32, borderRight: '1px solid var(--border-subtle)', minWidth: 160,
  },
  summaryPanel: { paddingLeft: 4 },
  swGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  swCard: {
    display: 'flex', gap: 12, padding: '13px 15px',
    background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
  },
  questionList: { display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 40 },
  qCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)', padding: 22, transition: 'border-color 0.2s',
  },
  qHeader: {
    display: 'flex', gap: 14, alignItems: 'flex-start', cursor: 'pointer',
    marginBottom: 16, userSelect: 'none',
  },
  qNumber: {
    minWidth: 36, height: 36, borderRadius: 8,
    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, color: 'var(--text-secondary)',
    flexShrink: 0,
  },
  qCategoryTag: {
    display: 'inline-block', marginBottom: 5, fontSize: 10,
    fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--accent-secondary)',
    background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)',
    borderRadius: 99, padding: '2px 8px',
  },
  qText: {
    fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 600,
    color: 'var(--text-primary)', lineHeight: 1.5,
  },
  miniBars: { display: 'flex', flexDirection: 'column', gap: 7 },
  miniBar: { display: 'flex', alignItems: 'center', gap: 10 },
  miniLabel: { width: 110, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 600 },
  miniTrack: { flex: 1, height: 5, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' },
  miniFill: { height: '100%', borderRadius: 99, transition: 'width 0.6s ease' },
  miniVal: { width: 28, fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, textAlign: 'right' },
  expandedSection: { marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 20 },
  feedbackBlock: {
    background: 'rgba(108,99,255,0.06)', borderLeft: '3px solid var(--accent-primary)',
    borderRadius: 'var(--radius-sm)', padding: '14px 16px',
  },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  strengthBlock: {
    background: 'rgba(52,211,153,0.06)', borderLeft: '3px solid var(--success)',
    borderRadius: 'var(--radius-sm)', padding: '13px 15px',
  },
  improveBlock: {
    background: 'rgba(251,191,36,0.06)', borderLeft: '3px solid var(--warning)',
    borderRadius: 'var(--radius-sm)', padding: '13px 15px',
  },
  answerBlock: { background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '13px 15px' },
  idealBlock: {
    background: 'rgba(96,165,250,0.06)', borderLeft: '3px solid var(--info)',
    borderRadius: 'var(--radius-sm)', padding: '13px 15px',
  },
  blockLabel: {
    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, color: 'var(--text-muted)',
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7,
  },
  scoreSummary: {
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)', padding: 28,
  },
  scoreGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 },
  scoreCard: { padding: '16px 8px' },
};