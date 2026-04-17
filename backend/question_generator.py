# question_generator.py
# Uses Groq API (FREE) — get key at console.groq.com
# Reads actual resume content and generates unique questions every time via AI.

import os
import json
import re
from groq import Groq
from typing import List, Dict
from dotenv import load_dotenv

load_dotenv()

# Groq client — reads GROQ_API_KEY from .env
client = Groq()
MODEL  = "llama-3.1-8b-instant"


# ─── Core AI call ──────────────────────────────────────────────────────────────

def call_groq(system_prompt: str, user_prompt: str, max_tokens: int = 3000) -> str:
    """Call Groq and return raw text response."""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            max_tokens=max_tokens,
            temperature=0.7,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        raise Exception(f"Groq API call failed: {str(e)}")


# ─── Robust JSON extraction ────────────────────────────────────────────────────

def extract_json_array(text: str) -> list:
    """
    Extract a JSON array from model output.
    Handles markdown fences, leading/trailing text, and partial wrapping.
    """
    # Remove markdown code fences
    text = re.sub(r"```(?:json)?", "", text).strip()

    # Direct parse attempt
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass

    # Find the first [ ... ] block in the text
    start = text.find("[")
    end   = text.rfind("]")
    if start != -1 and end != -1 and end > start:
        candidate = text[start:end+1]
        try:
            result = json.loads(candidate)
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

    raise ValueError(
        f"AI did not return valid JSON. Raw response (first 500 chars):\n{text[:500]}"
    )


# ─── Resume-based generation ───────────────────────────────────────────────────

def generate_questions_from_resume(
    resume_text: str,
    target_role: str,
    num_questions: int = 10,
) -> List[Dict]:
    """
    AI reads the full resume text and generates questions that reference
    the candidate's ACTUAL projects, skills, companies, and experience.
    Every call produces different questions.
    """

    system_prompt = """You are a senior technical interviewer with 15 years of experience at top tech companies.

You will receive a candidate's resume. Your job is to generate highly personalized interview questions based ONLY on what is written in that resume.

STRICT RULES:
1. Read the resume carefully. Reference the candidate's actual project names, technologies, companies, and responsibilities.
2. Do NOT ask generic questions like "Tell me about a time you worked in a team" without connecting it to something in their resume.
3. Mix of questions required:
   - 1 intro question (e.g. "Walk me through your background")
   - 2 behavioral questions referencing their actual experience
   - 7 technical questions based on the specific tools/languages/projects in their resume
4. Each question must include a detailed ideal_answer (4-6 sentences showing what a great answer looks like)
5. Output ONLY a valid raw JSON array. No markdown. No explanation. No text before or after the JSON.

Output format (ONLY this, nothing else):
[{"question": "...", "category": "intro|behavioral|technical", "ideal_answer": "..."}]"""

    user_prompt = (
        f"RESUME:\n{resume_text[:5000]}\n\n"
        f"TARGET ROLE: {target_role}\n\n"
        f"Generate exactly {num_questions} questions. Return ONLY the JSON array."
    )

    print(f"[AI] Calling Groq with {len(resume_text)} chars of resume text...")
    raw = call_groq(system_prompt, user_prompt, max_tokens=3500)
    print(f"[AI] Raw response length: {len(raw)} chars")
    print(f"[AI] Response preview: {raw[:300]}")

    questions_raw = extract_json_array(raw)
    return _normalize(questions_raw)


# ─── Role-based generation ─────────────────────────────────────────────────────

def generate_questions_for_role(
    target_role: str,
    num_questions: int = 10,
) -> List[Dict]:
    """
    Generate fresh interview questions for a job role without a resume.
    Questions are different every run due to AI temperature.
    """

    system_prompt = """You are a senior technical interviewer at a top tech company.

Generate a realistic, high-quality set of interview questions for the given job role.

STRICT RULES:
1. Include exactly this mix:
   - 1 intro question
   - 2 behavioral questions (STAR-method scenarios)
   - 7 technical questions specific to the role
2. Technical questions must test real skills needed for this role — not general trivia
3. Include both fundamental and advanced questions
4. Each question must have a detailed ideal_answer (4-6 sentences)
5. Output ONLY a valid raw JSON array. No markdown. No explanation before or after.

Output format (ONLY this):
[{"question": "...", "category": "intro|behavioral|technical", "ideal_answer": "..."}]"""

    user_prompt = (
        f"JOB ROLE: {target_role}\n\n"
        f"Generate exactly {num_questions} interview questions.\n"
        f"Return ONLY the JSON array."
    )

    print(f"[AI] Calling Groq for role: {target_role}")
    raw = call_groq(system_prompt, user_prompt, max_tokens=3500)
    print(f"[AI] Raw response length: {len(raw)} chars")

    questions_raw = extract_json_array(raw)
    return _normalize(questions_raw)


# ─── Normalize ────────────────────────────────────────────────────────────────

def _normalize(questions_raw: list) -> List[Dict]:
    """Validate structure and add order_index."""
    if not isinstance(questions_raw, list):
        raise ValueError(f"Expected a list from AI, got: {type(questions_raw)}")

    questions = []
    for i, q in enumerate(questions_raw):
        if not isinstance(q, dict):
            continue
        text = (q.get("question") or "").strip()
        if not text:
            continue
        questions.append({
            "question":    text,
            "category":    (q.get("category") or "technical").lower().strip(),
            "order_index": i + 1,
            "ideal_answer": (q.get("ideal_answer") or "Provide a structured answer with real examples.").strip(),
        })

    if not questions:
        raise ValueError("AI returned an empty question list. Try again.")

    return questions


# ─── Entry point ──────────────────────────────────────────────────────────────

def generate_questions(
    mode: str,
    target_role: str = None,
    skills: List[str] = None,   # unused, kept for compatibility
    resume_text: str = None,
    num_questions: int = 10,
) -> List[Dict]:
    role = (target_role or "Software Engineer").strip()

    if mode == "resume":
        if not resume_text or len(resume_text.strip()) < 50:
            raise ValueError("Resume text is empty or too short to generate questions from.")
        return generate_questions_from_resume(resume_text, role, num_questions)

    return generate_questions_for_role(role, num_questions)