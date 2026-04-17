// pages/Interview.js
// Clean interview flow — NO per-question score shown.
// Answer is submitted silently, then moves straight to next question.
// Full feedback only appears at the end in the Report page.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function Interview() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { sessionId, questions = [], skills = [], mode, role } = location.state || {};

  useEffect(() => {
    if (!sessionId || !questions.length) navigate('/dashboard');
  }, [sessionId, questions, navigate]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [currentIndex,      setCurrentIndex]      = useState(0);
  const [answerText,        setAnswerText]         = useState('');
  const [isListening,       setIsListening]        = useState(false);
  const [isSubmitting,      setIsSubmitting]       = useState(false);
  const [submitError,       setSubmitError]        = useState('');
  const [answeredQuestions, setAnsweredQuestions]  = useState([]);
  const [webcamError,       setWebcamError]        = useState('');
  const [micError,          setMicError]           = useState('');
  const [isFinishing,       setIsFinishing]        = useState(false);
  const [timeElapsed,       setTimeElapsed]        = useState(0);
  // 'answering' | 'submitted' (brief flash) | 'finishing'
  const [phase,             setPhase]              = useState('answering');

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef       = useRef(null);
  const streamRef      = useRef(null);
  const recognitionRef = useRef(null);
  const timerRef       = useRef(null);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion  = currentIndex === questions.length - 1;
  const progress        = ((currentIndex) / questions.length) * 100;

  // ── Webcam ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setWebcamError('Camera/mic access denied. Enable permissions to use webcam.');
      }
    })();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => setTimeElapsed(t => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const formatTime = s =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Text-to-Speech — reads each question aloud in a female voice ───────────
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speakQuestion = useCallback((text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // stop anything already playing

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate   = 0.93;  // natural interview pace
    utterance.pitch  = 1.1;   // slightly higher for female tone
    utterance.volume = 1.0;

    const assignAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      // Preferred female voice names across Chrome / Edge / Safari / Firefox
      const preferred = [
        'Google UK English Female',
        'Microsoft Zira - English (United States)',
        'Microsoft Susan - English (United States)',
        'Samantha',      // macOS / iOS
        'Victoria',      // macOS
        'Karen',         // macOS Australian
        'Moira',         // macOS Irish
        'Tessa',         // macOS South African
        'Fiona',         // macOS Scottish
      ];
      let chosen = null;
      for (const name of preferred) {
        chosen = voices.find(v => v.name.includes(name));
        if (chosen) break;
      }
      // Fallback: any English voice with "female" or "woman" in its name
      if (!chosen) chosen = voices.find(v => v.lang.startsWith('en') && /female|woman/i.test(v.name));
      // Final fallback: first English voice available
      if (!chosen) chosen = voices.find(v => v.lang.startsWith('en')) || voices[0];

      if (chosen) utterance.voice = chosen;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend   = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    };

    // Voices load asynchronously on first use — wait if not ready yet
    if (window.speechSynthesis.getVoices().length > 0) {
      assignAndSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        assignAndSpeak();
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // Speak question whenever a new one appears
  useEffect(() => {
    if (currentQuestion?.question_text && phase === 'answering') {
      const t = setTimeout(() => speakQuestion(currentQuestion.question_text), 450);
      return () => clearTimeout(t);
    }
  }, [currentIndex, phase, currentQuestion, speakQuestion]);

  // Cancel speech on unmount
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  // ── Speech Recognition ─────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setMicError('Speech recognition not supported in this browser. Please type your answer.');
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = 'en-US';

    rec.onresult = e => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setAnswerText(transcript);
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed') setMicError('Microphone access denied.');
      setIsListening(false);
    };
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
    setMicError('');
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  // ── Submit Answer ──────────────────────────────────────────────────────────
  const handleSubmitAnswer = async () => {
    if (!answerText.trim()) return;
    stopListening();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const res = await api.post('/session/submit-answer', {
        session_id:  sessionId,
        question_id: currentQuestion.id,
        answer_text: answerText.trim(),
      });

      // Accumulate silently — no score shown here
      setAnsweredQuestions(prev => [
        ...prev,
        { question: currentQuestion, answer: answerText.trim(), result: res.data },
      ]);

      // Brief "saved" flash then move on
      setPhase('submitted');
      setTimeout(() => {
        if (isLastQuestion) {
          handleFinish([
            ...answeredQuestions,
            { question: currentQuestion, answer: answerText.trim(), result: res.data },
          ]);
        } else {
          setCurrentIndex(i => i + 1);
          setAnswerText('');
          setPhase('answering');
        }
      }, 900);

    } catch (err) {
      setSubmitError('Failed to submit answer. Please try again.');
      setPhase('answering');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Finish ─────────────────────────────────────────────────────────────────
  const handleFinish = async (finalAnswers) => {
    setIsFinishing(true);
    try {
      const res = await api.post('/session/complete', { session_id: sessionId });
      navigate('/report', {
        state: {
          sessionId,
          report:           res.data,
          answeredQuestions: finalAnswers || answeredQuestions,
        },
      });
    } catch (err) {
      setSubmitError('Could not generate report. Please try again.');
      setIsFinishing(false);
    }
  };

  if (!currentQuestion) return null;

  const wordCount = answerText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div style={styles.page}>
      <div style={styles.bgGlow} />

      <div style={styles.layout}>

        {/* ── LEFT: Webcam + session info ───────────────────────────────── */}
        <div style={styles.leftPanel}>
          <div style={styles.webcamWrap}>
            {webcamError ? (
              <div style={styles.webcamError}>
                <span style={{ fontSize: 32 }}>📷</span>
                <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{webcamError}</p>
              </div>
            ) : (
              <video ref={videoRef} autoPlay muted playsInline style={styles.video} />
            )}
            <div style={styles.liveBadge}><div style={styles.liveDot} /><span>LIVE</span></div>
            <div style={styles.timerBadge}>{formatTime(timeElapsed)}</div>
          </div>

          <div style={styles.sessionInfo}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>MODE</span>
              <span style={styles.infoVal}>{mode === 'resume' ? '📄 Resume-Based' : '🎯 Role-Based'}</span>
            </div>
            {role && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>ROLE</span>
                <span style={styles.infoVal}>{role}</span>
              </div>
            )}
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>PROGRESS</span>
              <span style={styles.infoVal}>{currentIndex + 1} / {questions.length} questions</span>
            </div>
            {skills?.length > 0 && (
              <div>
                <span style={styles.infoLabel}>SKILLS DETECTED</span>
                <div style={styles.skillChips}>
                  {skills.slice(0, 6).map(s => (
                    <span key={s} style={styles.skillChip}>{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Question mini-map */}
          <div style={styles.miniMap}>
            {questions.map((_, i) => (
              <div
                key={i}
                style={{
                  ...styles.miniDot,
                  background: i < currentIndex
                    ? 'var(--success)'
                    : i === currentIndex
                    ? 'var(--accent-primary)'
                    : 'var(--bg-elevated)',
                  border: i === currentIndex ? '2px solid var(--accent-secondary)' : '2px solid transparent',
                }}
              />
            ))}
          </div>
        </div>

        {/* ── RIGHT: Question + Answer ──────────────────────────────────── */}
        <div style={styles.rightPanel}>

          {/* Progress bar */}
          <div style={styles.progressWrap}>
            <div style={styles.progressMeta}>
              <span style={styles.questionCount}>Question {currentIndex + 1} of {questions.length}</span>
              <span style={styles.categoryBadge}>{currentQuestion.category}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Question card — reads question aloud via TTS on load */}
          <div style={styles.questionCard}>
            <div style={styles.qIcon}>Q{currentIndex + 1}</div>
            <div style={{ flex: 1 }}>
              <p style={styles.questionText}>{currentQuestion.question_text}</p>
              <div style={styles.ttsRow}>
                {isSpeaking ? (
                  <div style={styles.speakingIndicator}>
                    <span style={styles.speakBar} />
                    <span style={{ ...styles.speakBar, animationDelay: '0.15s' }} />
                    <span style={{ ...styles.speakBar, animationDelay: '0.3s' }} />
                    <span style={{ ...styles.speakBar, animationDelay: '0.45s' }} />
                    <span style={styles.speakingLabel}>Speaking...</span>
                  </div>
                ) : (
                  <button
                    style={styles.replayBtn}
                    onClick={() => speakQuestion(currentQuestion.question_text)}
                    title="Replay question aloud"
                  >
                    ▶ Replay question
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Submitted flash ── */}
          {phase === 'submitted' && (
            <div style={styles.submittedFlash} className="page-enter">
              <span style={{ fontSize: 28 }}>✅</span>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginTop: 8 }}>
                Answer recorded
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                {isLastQuestion ? 'Generating your report...' : 'Loading next question...'}
              </p>
            </div>
          )}

          {/* ── Finishing ── */}
          {isFinishing && (
            <div style={styles.submittedFlash}>
              <div className="spinner" style={{ width: 36, height: 36 }} />
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginTop: 16 }}>
                Analyzing your interview...
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                AI is generating your full feedback report
              </p>
            </div>
          )}

          {/* ── Answering phase ── */}
          {phase === 'answering' && !isFinishing && (
            <div style={styles.answerSection}>

              {micError && <div className="alert alert-error">{micError}</div>}
              {submitError && <div className="alert alert-error">{submitError}</div>}

              {/* Mic button */}
              <div style={styles.micRow}>
                <button
                  className={`btn ${isListening ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={isListening ? stopListening : startListening}
                >
                  {isListening
                    ? <><span style={styles.pulsingDot} /> Stop Recording</>
                    : <>🎤 Start Recording</>
                  }
                </button>
                {isListening && (
                  <span style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
                    🔴 Listening...
                  </span>
                )}
              </div>

              {/* Answer textarea */}
              <div>
                <label style={styles.answerLabel}>Your Answer</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 180, fontSize: 15, lineHeight: 1.7, resize: 'vertical' }}
                  value={answerText}
                  onChange={e => setAnswerText(e.target.value)}
                  placeholder="Start recording or type your answer here. Be specific and detailed for the best evaluation."
                  disabled={isListening}
                />
                <div style={styles.wordCount}>
                  <span style={{ color: wordCount < 30 ? 'var(--warning)' : 'var(--success)' }}>
                    {wordCount} words
                  </span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                    {wordCount < 30
                      ? '— aim for at least 50 words for a good score'
                      : wordCount < 80
                      ? '— decent, more detail will help'
                      : '— good length ✓'}
                  </span>
                </div>
              </div>

              {/* Submit */}
              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleSubmitAnswer}
                disabled={isSubmitting || !answerText.trim() || isListening}
              >
                {isSubmitting
                  ? <><span className="spinner" /> Saving...</>
                  : isLastQuestion
                  ? '✓ Submit & Get Report'
                  : '✓ Submit & Next Question'
                }
              </button>

              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                Full AI feedback will be shown after you complete all {questions.length} questions
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: 'calc(100vh - 64px)', position: 'relative', padding: '24px' },
  bgGlow: {
    position: 'fixed', top: 0, right: 0,
    width: 380, height: 380,
    background: 'radial-gradient(circle, rgba(108,99,255,0.07) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
  },
  layout: {
    maxWidth: 1100, margin: '0 auto',
    display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'start',
  },
  leftPanel: { display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 88 },
  webcamWrap: {
    position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', aspectRatio: '4/3',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' },
  webcamError: {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center',
  },
  liveBadge: {
    position: 'absolute', top: 10, left: 10,
    background: 'rgba(248,113,113,0.9)', color: '#fff', borderRadius: 99,
    padding: '3px 9px', fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700,
    letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: '50%', background: '#fff',
    animation: 'pulse 1.2s ease infinite',
  },
  timerBadge: {
    position: 'absolute', top: 10, right: 10,
    background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 6,
    padding: '3px 9px', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700,
    backdropFilter: 'blur(4px)',
  },
  sessionInfo: {
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)', padding: 14,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  infoRow: { display: 'flex', flexDirection: 'column', gap: 2 },
  infoLabel: { color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.08em' },
  infoVal: { color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 },
  skillChips: { display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  skillChip: {
    background: 'rgba(108,99,255,0.12)', color: 'var(--accent-secondary)',
    border: '1px solid rgba(108,99,255,0.25)', borderRadius: 99,
    padding: '2px 8px', fontSize: 10, fontWeight: 600,
  },
  miniMap: { display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 0' },
  miniDot: { width: 20, height: 20, borderRadius: 6, transition: 'all 0.3s ease' },
  rightPanel: { display: 'flex', flexDirection: 'column', gap: 20 },
  progressWrap: { display: 'flex', flexDirection: 'column', gap: 10 },
  progressMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  questionCount: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text-secondary)' },
  categoryBadge: {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
    borderRadius: 99, padding: '4px 12px', fontSize: 11,
    fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--accent-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  questionCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)', padding: '28px',
    display: 'flex', gap: 18, alignItems: 'flex-start',
    boxShadow: 'var(--shadow-glow)',
  },
  qIcon: {
    minWidth: 44, height: 44, borderRadius: 'var(--radius-sm)',
    background: 'linear-gradient(135deg, #6c63ff22, #a78bfa22)',
    border: '1px solid var(--border-accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
    color: 'var(--accent-secondary)',
  },
  questionText: {
    fontSize: 19, fontFamily: 'var(--font-display)', fontWeight: 600,
    color: 'var(--text-primary)', lineHeight: 1.5, letterSpacing: '-0.01em',
  },
  answerSection: {
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)', padding: 24,
    display: 'flex', flexDirection: 'column', gap: 16,
  },
  micRow: { display: 'flex', alignItems: 'center', gap: 14 },
  pulsingDot: {
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
    background: 'currentColor', animation: 'pulse 1s ease infinite',
  },
  answerLabel: {
    display: 'block', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600,
    color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8,
  },
  wordCount: { marginTop: 6, fontSize: 12, display: 'flex', alignItems: 'center' },
  submittedFlash: {
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)', padding: '48px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', textAlign: 'center', minHeight: 280,
  },
  // TTS styles
  ttsRow: { marginTop: 12, display: 'flex', alignItems: 'center' },
  speakingIndicator: { display: 'flex', alignItems: 'center', gap: 4 },
  speakBar: {
    display: 'inline-block', width: 3, height: 14,
    background: 'var(--accent-primary)', borderRadius: 2,
    animation: 'speakPulse 0.7s ease-in-out infinite alternate',
  },
  speakingLabel: { color: 'var(--accent-secondary)', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, marginLeft: 8, letterSpacing: '0.04em' },
  replayBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-display)',
    fontWeight: 500, padding: '4px 0', display: 'flex', alignItems: 'center', gap: 5,
    transition: 'color 0.15s',
  },
};