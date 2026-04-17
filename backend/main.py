# main.py - FastAPI application — all API routes

import json
import traceback
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import execute_query
from auth import hash_password, verify_password, create_access_token, get_current_user, decode_token
from resume_parser import parse_resume
from question_generator import generate_questions
from evaluator import evaluate_answer

app = FastAPI(title="AI Interview Tool API", version="2.0.0")

# CORS — reads ALLOWED_ORIGINS from .env for production
# Set ALLOWED_ORIGINS=https://yourdomain.com in production .env
# Defaults to localhost for local dev
import os as _os
_raw_origins = _os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
_origins = [o.strip() for o in _raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Pydantic Models ───────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class StartRoleSessionRequest(BaseModel):
    target_role: str

class SubmitAnswerRequest(BaseModel):
    session_id: int
    question_id: int
    answer_text: str

class CompleteSessionRequest(BaseModel):
    session_id: int


# ─── Auth helper for multipart routes ─────────────────────────────────────────

def get_user_from_token_str(token: str) -> dict:
    """Decode JWT passed as a form field (used in file upload routes)."""
    token = token.strip()
    if token.lower().startswith("bearer "):
        token = token[7:]
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return {
        "user_id": int(user_id),
        "email": payload.get("email"),
        "name": payload.get("name"),
    }


# ─── Auth Routes ──────────────────────────────────────────────────────────────

@app.post("/api/auth/signup")
def signup(req: SignupRequest):
    existing = execute_query(
        "SELECT id FROM users WHERE email=%s", (req.email,), fetch=True
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")
    password_hash = hash_password(req.password)
    user_id = execute_query(
        "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)",
        (req.name, req.email, password_hash)
    )
    token = create_access_token({"sub": str(user_id), "email": req.email, "name": req.name})
    return {"token": token, "user": {"id": user_id, "name": req.name, "email": req.email}}


@app.post("/api/auth/login")
def login(req: LoginRequest):
    users = execute_query("SELECT * FROM users WHERE email=%s", (req.email,), fetch=True)
    if not users:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    user = users[0]
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token({
        "sub": str(user["id"]), "email": user["email"], "name": user["name"]
    })
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}


@app.get("/api/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    users = execute_query(
        "SELECT id, name, email, created_at FROM users WHERE id=%s",
        (current_user["user_id"],), fetch=True
    )
    if not users:
        raise HTTPException(status_code=404, detail="User not found.")
    return users[0]


# ─── Session Routes ───────────────────────────────────────────────────────────

@app.post("/api/session/start-resume")
async def start_resume_session(
    file: UploadFile = File(...),
    target_role: str = Form("Software Engineer"),
    token: str = Form(...),
):
    """
    Step 1: Authenticate via form-field token
    Step 2: Extract text from uploaded PDF/DOCX
    Step 3: AI reads resume text → generates personalized questions
    Step 4: Save to DB and return
    """

    # ── Step 1: Auth ──
    try:
        current_user = get_user_from_token_str(token)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

    # ── Step 2: Read file ──
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read uploaded file: {str(e)}")

    if not file_bytes or len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    print(f"\n[RESUME] File: '{file.filename}' | Size: {len(file_bytes)} bytes")

    # ── Step 3: Parse resume text ──
    try:
        parsed = parse_resume(file_bytes, file.filename)
        resume_text = parsed["text"]
        print(f"[RESUME] Extracted {len(resume_text)} characters of text")
        print(f"[RESUME] Preview: {resume_text[:200]!r}")
    except ValueError as e:
        print(f"[RESUME ERROR] {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[RESUME ERROR] Unexpected: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Resume parsing failed: {str(e)}")

    role = (target_role or "Software Engineer").strip()

    # ── Step 4: Save session ──
    try:
        session_id = execute_query(
            """INSERT INTO sessions (user_id, mode, target_role, resume_text, skills, status)
               VALUES (%s, 'resume', %s, %s, %s, 'active')""",
            (current_user["user_id"], role, resume_text[:8000], json.dumps([]))
        )
        print(f"[SESSION] Created session_id={session_id}")
    except Exception as e:
        print(f"[DB ERROR] {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    # ── Step 5: Generate questions via AI ──
    print(f"[AI] Sending resume to AI for question generation...")
    try:
        questions = generate_questions(
            mode="resume",
            target_role=role,
            resume_text=resume_text,
            num_questions=10,
        )
        print(f"[AI] Generated {len(questions)} questions successfully")
    except Exception as e:
        # Clean up the empty session on failure
        try:
            execute_query("DELETE FROM sessions WHERE id=%s", (session_id,))
        except Exception:
            pass
        print(f"[AI ERROR] {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"AI question generation failed: {str(e)}")

    # ── Step 6: Save questions ──
    try:
        for q in questions:
            execute_query(
                """INSERT INTO questions (session_id, question_text, category, order_index, ideal_answer)
                   VALUES (%s, %s, %s, %s, %s)""",
                (session_id, q["question"], q["category"], q["order_index"], q["ideal_answer"])
            )
    except Exception as e:
        print(f"[DB ERROR] Saving questions: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to save questions: {str(e)}")

    saved_questions = execute_query(
        "SELECT * FROM questions WHERE session_id=%s ORDER BY order_index",
        (session_id,), fetch=True
    )

    print(f"[DONE] Resume session ready — {len(saved_questions)} questions saved\n")

    return {
        "session_id": session_id,
        "resume_chars": len(resume_text),
        "questions": saved_questions,
        "total_questions": len(saved_questions),
    }


@app.post("/api/session/start-role")
def start_role_session(
    req: StartRoleSessionRequest,
    current_user: dict = Depends(get_current_user)
):
    role = (req.target_role or "Software Engineer").strip()
    print(f"\n[ROLE] Generating questions for role: {role}")

    try:
        session_id = execute_query(
            "INSERT INTO sessions (user_id, mode, target_role, status) VALUES (%s, 'role', %s, 'active')",
            (current_user["user_id"], role)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    try:
        questions = generate_questions(mode="role", target_role=role, num_questions=10)
        print(f"[AI] Generated {len(questions)} questions for role: {role}")
    except Exception as e:
        try:
            execute_query("DELETE FROM sessions WHERE id=%s", (session_id,))
        except Exception:
            pass
        print(f"[AI ERROR] {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"AI question generation failed: {str(e)}")

    for q in questions:
        execute_query(
            """INSERT INTO questions (session_id, question_text, category, order_index, ideal_answer)
               VALUES (%s, %s, %s, %s, %s)""",
            (session_id, q["question"], q["category"], q["order_index"], q["ideal_answer"])
        )

    saved_questions = execute_query(
        "SELECT * FROM questions WHERE session_id=%s ORDER BY order_index",
        (session_id,), fetch=True
    )

    return {
        "session_id": session_id,
        "questions": saved_questions,
        "total_questions": len(saved_questions),
    }


@app.post("/api/session/submit-answer")
def submit_answer(
    req: SubmitAnswerRequest,
    current_user: dict = Depends(get_current_user)
):
    questions = execute_query(
        "SELECT * FROM questions WHERE id=%s", (req.question_id,), fetch=True
    )
    if not questions:
        raise HTTPException(status_code=404, detail="Question not found.")
    question = questions[0]

    evaluation = evaluate_answer(
        answer=req.answer_text,
        question=question["question_text"],
        ideal_answer=question["ideal_answer"],
    )

    execute_query(
        """INSERT INTO answers
           (question_id, session_id, answer_text, score_relevance, score_technical,
            score_confidence, score_communication, overall_score, feedback, strengths, improvements)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (
            req.question_id, req.session_id, req.answer_text,
            evaluation["relevance"], evaluation["technical"],
            evaluation["confidence"], evaluation["communication"],
            evaluation["overall"], evaluation["feedback"],
            evaluation["strengths"], evaluation["improvements"],
        )
    )

    return {
        "scores": {
            "relevance":     evaluation["relevance"],
            "technical":     evaluation["technical"],
            "confidence":    evaluation["confidence"],
            "communication": evaluation["communication"],
            "overall":       evaluation["overall"],
        },
        "feedback":     evaluation["feedback"],
        "ideal_answer": question["ideal_answer"],
    }


@app.post("/api/session/complete")
def complete_session(
    req: CompleteSessionRequest,
    current_user: dict = Depends(get_current_user)
):
    answers = execute_query(
        "SELECT * FROM answers WHERE session_id=%s", (req.session_id,), fetch=True
    )
    if not answers:
        raise HTTPException(status_code=400, detail="No answers found for this session.")

    overall_score = round(sum(a["overall_score"] for a in answers) / len(answers), 2)

    all_strengths  = [a["strengths"]    for a in answers if a["strengths"]    and "Keep practicing" not in a["strengths"]]
    all_weaknesses = [a["improvements"] for a in answers if a["improvements"] and "Great job"        not in a["improvements"]]

    strengths_summary  = " | ".join(list(set(all_strengths))[:3])  or "Continue developing your skills."
    weaknesses_summary = " | ".join(list(set(all_weaknesses))[:3]) or "No major weaknesses identified."

    if overall_score >= 8:
        summary = "Outstanding performance! You are well-prepared for this interview."
    elif overall_score >= 6:
        summary = "Good performance! Review the suggestions to polish your answers."
    elif overall_score >= 4:
        summary = "Fair performance. Focus on depth, structure, and confidence."
    else:
        summary = "Needs more preparation. Practice with STAR method and review core concepts."

    execute_query(
        """INSERT INTO reports (session_id, overall_score, strengths, weaknesses, summary)
           VALUES (%s, %s, %s, %s, %s)
           ON DUPLICATE KEY UPDATE overall_score=%s, strengths=%s, weaknesses=%s, summary=%s""",
        (req.session_id, overall_score, strengths_summary, weaknesses_summary, summary,
         overall_score, strengths_summary, weaknesses_summary, summary)
    )
    execute_query(
        "UPDATE sessions SET status='completed', completed_at=NOW() WHERE id=%s",
        (req.session_id,)
    )

    return {
        "overall_score":   overall_score,
        "strengths":       strengths_summary,
        "weaknesses":      weaknesses_summary,
        "summary":         summary,
        "total_questions": len(answers),
    }


# ─── Report / History ─────────────────────────────────────────────────────────

@app.get("/api/session/{session_id}/report")
def get_session_report(session_id: int, current_user: dict = Depends(get_current_user)):
    sessions = execute_query("SELECT * FROM sessions WHERE id=%s", (session_id,), fetch=True)
    if not sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
    questions = execute_query(
        """SELECT q.id, q.question_text, q.category, q.order_index, q.ideal_answer,
                  a.answer_text, a.score_relevance, a.score_technical, a.score_confidence,
                  a.score_communication, a.overall_score, a.feedback, a.strengths, a.improvements
           FROM questions q
           LEFT JOIN answers a ON a.question_id = q.id AND a.session_id = %s
           WHERE q.session_id = %s ORDER BY q.order_index""",
        (session_id, session_id), fetch=True
    )
    reports = execute_query("SELECT * FROM reports WHERE session_id=%s", (session_id,), fetch=True)
    return {"session": sessions[0], "questions": questions, "report": reports[0] if reports else {}}


@app.get("/api/user/history")
def get_user_history(current_user: dict = Depends(get_current_user)):
    sessions = execute_query(
        """SELECT s.id, s.mode, s.target_role, s.status, s.created_at, s.completed_at,
                  r.overall_score
           FROM sessions s LEFT JOIN reports r ON r.session_id = s.id
           WHERE s.user_id = %s ORDER BY s.created_at DESC""",
        (current_user["user_id"],), fetch=True
    )
    return {"sessions": sessions}


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0"}