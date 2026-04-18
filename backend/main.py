# main.py — FastAPI app using Firebase Firestore (no MySQL)
# All data operations use Firestore documents instead of SQL queries.

import os
import json
import traceback
from datetime import datetime, timezone
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from database import db
from auth import hash_password, verify_password, create_access_token, get_current_user, decode_token
from resume_parser import parse_resume
from question_generator import generate_questions
from evaluator import evaluate_answer
from fastapi import Request
from fastapi.responses import JSONResponse, Response


app = FastAPI(title="IntPrep API", version="3.0.0")

# ── CORS 

_origins = [
    "http://localhost:3000",
    "https://intprep1.netlify.app",
    "https://intprep-backend.onrender.com",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["_origins"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("🔥 ERROR:", str(exc))
    return JSONResponse(status_code=500, content={"error": str(exc)})


@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {"status": "running"}


# ── Pydantic Models ────────────────────────────────────────────────────────────

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
    session_id: str    # Firestore doc IDs are strings
    question_id: str
    answer_text: str

class CompleteSessionRequest(BaseModel):
    session_id: str


# ── Firestore helpers ──────────────────────────────────────────────────────────

def _doc_to_dict(doc):
    """Convert a Firestore DocumentSnapshot to a plain dict with 'id' field."""
    if not doc.exists:
        return None
    d = doc.to_dict()
    d["id"] = doc.id
    # Convert any Firestore DatetimeWithNanoseconds to ISO string
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d


def _now():
    return datetime.now(timezone.utc).isoformat()


# ── Auth helper for multipart (file upload) routes ─────────────────────────────

def get_user_from_token_str(token: str) -> dict:
    """Decode JWT passed as a form field (needed because HTTPBearer + File() conflict)."""
    token = token.strip()
    if token.lower().startswith("bearer "):
        token = token[7:]
    payload = decode_token(token)
    uid = payload.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return {"user_id": uid, "email": payload.get("email"), "name": payload.get("name")}


# ── AUTH ROUTES ────────────────────────────────────────────────────────────────

@app.post("/api/auth/signup")
def signup(req: SignupRequest):
    # Check email uniqueness
    existing = db.collection("users").where("email", "==", req.email).limit(1).get()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    password_hash = hash_password(req.password)
    now = _now()

    # Add user document — Firestore auto-generates the ID
    ref = db.collection("users").add({
        "name":          req.name,
        "email":         req.email,
        "password_hash": password_hash,
        "created_at":    now,
    })
    user_id = ref[1].id   # ref is (timestamp, DocumentReference)

    token = create_access_token({"sub": user_id, "email": req.email, "name": req.name})
    return {"token": token, "user": {"id": user_id, "name": req.name, "email": req.email}}


@app.post("/api/auth/login")
def login(req: LoginRequest):
    try:
        print("🔥 LOGIN HIT", req)

        docs = db.collection("users").where("email", "==", req.email).limit(1).get()
        print("📦 docs:", docs)

        if not docs:
            raise HTTPException(status_code=401, detail="Invalid email or password.")

        user = _doc_to_dict(docs[0])
        print("👤 user:", user)

        if not verify_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password.")

        token = create_access_token({
            "sub": user["id"],
            "email": user["email"],
            "name": user["name"]
        })

        return {"token": token, "user": user}

    except Exception as e:
        print("🔥 LOGIN ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    doc = db.collection("users").document(current_user["user_id"]).get()
    user = _doc_to_dict(doc)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    # Don't expose password hash
    user.pop("password_hash", None)
    return user


# ── SESSION ROUTES ─────────────────────────────────────────────────────────────

@app.post("/api/session/start-resume")
async def start_resume_session(
    file: UploadFile = File(...),
    target_role: str = Form("Software Engineer"),
    token: str = Form(...),   # JWT as form field — avoids HTTPBearer + File() conflict
):
    """Upload resume → AI reads it → generates 10 personalized questions → save to Firestore."""

    current_user = get_user_from_token_str(token)

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Parse PDF/DOCX → raw text
    try:
        parsed = parse_resume(file_bytes, file.filename)
        resume_text = parsed["text"]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resume parsing failed: {str(e)}")

    role = (target_role or "Software Engineer").strip()

    # Create session document
    session_ref = db.collection("sessions").add({
        "user_id":     current_user["user_id"],
        "mode":        "resume",
        "target_role": role,
        "resume_text": resume_text[:8000],
        "status":      "active",
        "created_at":  _now(),
        "completed_at": None,
    })
    session_id = session_ref[1].id

    # AI generates questions from resume
    try:
        questions = generate_questions(
            mode="resume",
            target_role=role,
            resume_text=resume_text,
            num_questions=10,
        )
    except Exception as e:
        # Clean up orphan session
        db.collection("sessions").document(session_id).delete()
        raise HTTPException(status_code=500, detail=f"AI question generation failed: {str(e)}")

    # Save questions as sub-collection under the session
    saved_questions = []
    for q in questions:
        q_ref = db.collection("sessions").document(session_id)\
                  .collection("questions").add({
                      "question_text": q["question"],
                      "category":      q["category"],
                      "order_index":   q["order_index"],
                      "ideal_answer":  q["ideal_answer"],
                  })
        saved_questions.append({
            "id":            q_ref[1].id,
            "question_text": q["question"],
            "category":      q["category"],
            "order_index":   q["order_index"],
            "ideal_answer":  q["ideal_answer"],
        })

    # Sort by order_index for consistent display
    saved_questions.sort(key=lambda x: x["order_index"])

    return {
        "session_id":     session_id,
        "resume_chars":   len(resume_text),
        "questions":      saved_questions,
        "total_questions": len(saved_questions),
    }


@app.post("/api/session/start-role")
def start_role_session(
    req: StartRoleSessionRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate questions for a target role (no resume) → save to Firestore."""
    role = (req.target_role or "Software Engineer").strip()

    session_ref = db.collection("sessions").add({
        "user_id":      current_user["user_id"],
        "mode":         "role",
        "target_role":  role,
        "status":       "active",
        "created_at":   _now(),
        "completed_at": None,
    })
    session_id = session_ref[1].id

    try:
        questions = generate_questions(mode="role", target_role=role, num_questions=10)
    except Exception as e:
        db.collection("sessions").document(session_id).delete()
        raise HTTPException(status_code=500, detail=f"AI question generation failed: {str(e)}")

    saved_questions = []
    for q in questions:
        q_ref = db.collection("sessions").document(session_id)\
                  .collection("questions").add({
                      "question_text": q["question"],
                      "category":      q["category"],
                      "order_index":   q["order_index"],
                      "ideal_answer":  q["ideal_answer"],
                  })
        saved_questions.append({
            "id":            q_ref[1].id,
            "question_text": q["question"],
            "category":      q["category"],
            "order_index":   q["order_index"],
            "ideal_answer":  q["ideal_answer"],
        })

    saved_questions.sort(key=lambda x: x["order_index"])

    return {
        "session_id":      session_id,
        "questions":       saved_questions,
        "total_questions": len(saved_questions),
    }


@app.post("/api/session/submit-answer")
def submit_answer(
    req: SubmitAnswerRequest,
    current_user: dict = Depends(get_current_user),
):
    """Evaluate an answer via NLP + AI, save scores to Firestore."""
    # Fetch the question document
    q_doc = db.collection("sessions").document(req.session_id)\
              .collection("questions").document(req.question_id).get()

    if not q_doc.exists:
        raise HTTPException(status_code=404, detail="Question not found.")

    question = q_doc.to_dict()

    # Evaluate the answer
    evaluation = evaluate_answer(
        answer=req.answer_text,
        question=question["question_text"],
        ideal_answer=question["ideal_answer"],
    )

    # Save answer as a document keyed by question_id (so it's easy to look up)
    db.collection("sessions").document(req.session_id)\
      .collection("answers").document(req.question_id).set({
          "question_id":        req.question_id,
          "answer_text":        req.answer_text,
          "score_relevance":    evaluation["relevance"],
          "score_technical":    evaluation["technical"],
          "score_confidence":   evaluation["confidence"],
          "score_communication": evaluation["communication"],
          "overall_score":      evaluation["overall"],
          "feedback":           evaluation["feedback"],
          "strengths":          evaluation["strengths"],
          "improvements":       evaluation["improvements"],
          "answered_at":        _now(),
      })

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
    current_user: dict = Depends(get_current_user),
):
    """Compute overall score, write report document, mark session completed."""
    answers_docs = db.collection("sessions").document(req.session_id)\
                     .collection("answers").get()

    answers = [d.to_dict() for d in answers_docs]

    if not answers:
        raise HTTPException(status_code=400, detail="No answers found for this session.")

    overall_score = round(sum(a["overall_score"] for a in answers) / len(answers), 2)

    all_strengths  = [a["strengths"]    for a in answers if a.get("strengths")    and "Keep practicing" not in a["strengths"]]
    all_weaknesses = [a["improvements"] for a in answers if a.get("improvements") and "Great job"        not in a["improvements"]]

    strengths_summary  = " | ".join(list(set(all_strengths))[:3])  or "Continue developing your skills."
    weaknesses_summary = " | ".join(list(set(all_weaknesses))[:3]) or "No major weaknesses identified."

    if overall_score >= 8:
        summary = "Outstanding performance! You are well-prepared for this interview."
    elif overall_score >= 6:
        summary = "Good performance! Review the suggestions to polish your answers."
    elif overall_score >= 4:
        summary = "Fair performance. Focus on depth, structure, and confidence."
    else:
        summary = "Needs more preparation. Practice regularly and review core concepts."

    # Write report (same ID as session for easy lookup)
    db.collection("reports").document(req.session_id).set({
        "session_id":    req.session_id,
        "overall_score": overall_score,
        "strengths":     strengths_summary,
        "weaknesses":    weaknesses_summary,
        "summary":       summary,
        "generated_at":  _now(),
    })

    # Mark session as completed
    db.collection("sessions").document(req.session_id).update({
        "status":       "completed",
        "completed_at": _now(),
    })

    return {
        "overall_score":   overall_score,
        "strengths":       strengths_summary,
        "weaknesses":      weaknesses_summary,
        "summary":         summary,
        "total_questions": len(answers),
    }


# ── REPORT / HISTORY ───────────────────────────────────────────────────────────

@app.get("/api/session/{session_id}/report")
def get_session_report(session_id: str, current_user: dict = Depends(get_current_user)):
    session_doc = db.collection("sessions").document(session_id).get()
    if not session_doc.exists:
        raise HTTPException(status_code=404, detail="Session not found.")

    session = _doc_to_dict(session_doc)

    # Fetch questions
    q_docs = db.collection("sessions").document(session_id)\
               .collection("questions").order_by("order_index").get()

    # Fetch answers (keyed by question_id)
    a_docs = db.collection("sessions").document(session_id)\
               .collection("answers").get()
    answers_map = {d.id: d.to_dict() for d in a_docs}

    questions = []
    for q_doc in q_docs:
        q = _doc_to_dict(q_doc)
        a = answers_map.get(q_doc.id, {})
        questions.append({**q, **a})

    report_doc = db.collection("reports").document(session_id).get()
    report = _doc_to_dict(report_doc) if report_doc.exists else {}

    return {"session": session, "questions": questions, "report": report}


@app.get("/api/user/history")
def get_user_history(current_user: dict = Depends(get_current_user)):
    # NOTE: No order_by here — combining where() + order_by() requires a
    # Firestore composite index. We sort in Python instead to avoid that.
    session_docs = db.collection("sessions")                     .where("user_id", "==", current_user["user_id"])                     .get()

    sessions = []
    for doc in session_docs:
        s = _doc_to_dict(doc)
        # Attach overall_score from report if it exists
        report_doc = db.collection("reports").document(doc.id).get()
        s["overall_score"] = report_doc.to_dict().get("overall_score") if report_doc.exists else None
        sessions.append(s)

    # Sort by created_at descending in Python (newest first)
    sessions.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    return {"sessions": sessions}


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "3.0.0", "db": "firestore"}
