# evaluator.py
# Proper answer evaluation with two layers:
#   1. Hard rules — catches garbage answers ("ok", "idk", single words) and scores them near 0
#   2. NLP scoring — TF-IDF + heuristics for real answers
#   3. AI feedback via Groq — intelligent, specific feedback (not STAR boilerplate)

import re
import nltk
import numpy as np
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# Download NLTK data once
for resource in [("tokenizers", "punkt_tab"), ("corpora", "stopwords")]:
    try:
        nltk.data.find(f"{resource[0]}/{resource[1]}")
    except LookupError:
        nltk.download(resource[1], quiet=True)

groq_client = Groq()
FEEDBACK_MODEL = "llama-3.1-8b-instant"

# Answers that are clearly not real attempts
JUNK_PATTERNS = [
    r"^(ok|okay|yes|no|idk|i don'?t know|hmm+|uh+|um+|na|n/a|none|nothing|skip|pass|\.+|,+|-+)$",
    r"^.{1,8}$",   # anything under 9 characters is almost certainly garbage
]


# ─── Junk detection ────────────────────────────────────────────────────────────

def is_junk_answer(answer: str) -> bool:
    """Return True if the answer is clearly not a real attempt."""
    cleaned = answer.strip().lower()
    if not cleaned:
        return True
    for pattern in JUNK_PATTERNS:
        if re.match(pattern, cleaned, re.IGNORECASE):
            return True
    # Less than 5 words is also basically nothing
    if len(cleaned.split()) < 5:
        return True
    return False


# ─── Scoring functions ─────────────────────────────────────────────────────────

def score_relevance(answer: str, question: str, ideal_answer: str) -> float:
    """TF-IDF cosine similarity between answer and (question + ideal answer)."""
    reference = question + " " + ideal_answer
    try:
        vec = TfidfVectorizer(stop_words="english")
        matrix = vec.fit_transform([answer.lower(), reference.lower()])
        sim = cosine_similarity(matrix[0:1], matrix[1:2])[0][0]
        # Scale: similarity of 0.5+ is genuinely relevant → map to ~8-9
        return round(min(sim * 14, 10.0), 2)
    except Exception:
        return 0.0


def score_depth(answer: str, question: str) -> float:
    """
    Measures how substantive the answer is.
    Checks: word count, keyword overlap with question, sentence count.
    Properly penalises short/thin answers.
    """
    stop_words = set(stopwords.words("english"))
    a_words = [w.lower() for w in word_tokenize(answer) if w.isalpha() and w.lower() not in stop_words]
    q_words = {w.lower() for w in word_tokenize(question) if w.isalpha() and w.lower() not in stop_words}

    word_count = len(answer.split())
    unique_content_words = len(set(a_words))
    sentences = sent_tokenize(answer)
    sent_count = len(sentences)

    # Word count score — need at least 40 words for a decent answer
    if word_count < 10:
        wc_score = 0.5
    elif word_count < 25:
        wc_score = 2.0
    elif word_count < 50:
        wc_score = 4.5
    elif word_count < 80:
        wc_score = 6.5
    elif word_count <= 200:
        wc_score = 9.0
    else:
        wc_score = 7.5  # too long

    # Keyword overlap with question
    overlap = len(q_words & set(a_words)) / max(len(q_words), 1)
    keyword_score = min(overlap * 10, 10.0)

    # Sentence structure
    if sent_count < 2:
        sent_score = 1.0
    elif sent_count < 4:
        sent_score = 5.0
    else:
        sent_score = 8.5

    return round((wc_score * 0.5) + (keyword_score * 0.3) + (sent_score * 0.2), 2)


def score_confidence(answer: str) -> float:
    """
    Heuristic confidence based on:
    - Filler/hedge words (penalise)
    - Action/strong words (reward)
    - Decisiveness of language
    """
    if len(answer.split()) < 5:
        return 0.5

    answer_lower = answer.lower()

    WEAK = ["um", "uh", "like", "basically", "kind of", "sort of",
            "i guess", "i think maybe", "not sure", "i don't know",
            "i'm not sure", "perhaps", "possibly", "i might"]
    STRONG = ["implemented", "designed", "built", "developed", "led", "achieved",
              "improved", "reduced", "increased", "delivered", "managed",
              "created", "optimized", "solved", "demonstrated", "established"]

    weak_hits  = sum(1 for w in WEAK   if w in answer_lower)
    strong_hits = sum(1 for w in STRONG if w in answer_lower)

    base = 5.0
    base -= weak_hits * 1.2
    base += strong_hits * 0.8
    base = max(0.0, min(base, 10.0))

    # Very short answers get confidence penalty regardless
    word_count = len(answer.split())
    if word_count < 20:
        base = min(base, 3.5)

    return round(base, 2)


def score_communication(answer: str) -> float:
    """Vocabulary diversity + sentence variety."""
    words = word_tokenize(answer.lower())
    alpha = [w for w in words if w.isalpha()]
    sentences = sent_tokenize(answer)

    if not alpha or len(sentences) < 1:
        return 0.5

    # Type-token ratio
    ttr = len(set(alpha)) / len(alpha)

    # Sentence variety
    if len(sentences) == 1:
        variety = 0.2
    else:
        lengths = [len(s.split()) for s in sentences]
        variety = min(np.std(lengths) / 8, 1.0)

    sent_score = min(len(sentences) / 5, 1.0)

    score = (ttr * 4.5) + (sent_score * 3.5) + (variety * 2.0)
    return round(min(score, 10.0), 2)


# ─── AI Feedback via Groq ──────────────────────────────────────────────────────

def generate_ai_feedback(
    question: str,
    answer: str,
    ideal_answer: str,
    scores: dict,
) -> dict:
    """
    Use Groq LLM to generate intelligent, specific feedback.
    NOT generic STAR boilerplate — actual analysis of what they said vs what was needed.
    """

    overall = scores["overall"]

    # Don't waste API call on junk — give direct harsh feedback
    if overall < 1.5:
        return {
            "feedback": "This response does not constitute a real answer. A blank, single-word, or meaningless response cannot be evaluated.",
            "strengths": "None identifiable from this response.",
            "improvements": "Provide a complete, thoughtful answer. Even a basic attempt would score significantly higher.",
        }

    system_prompt = """You are an expert interview coach giving feedback on a candidate's answer.
Be specific, direct, and intelligent. Analyze the ACTUAL content of their answer.

Rules:
- Do NOT use generic phrases like "use the STAR method", "structure your answer", or "be more specific" unless directly applicable
- Reference what they actually said — quote or paraphrase specific parts
- Point out exactly what was missing technically or conceptually
- If they mentioned something correct, acknowledge it specifically
- Keep each field to 2-3 sentences max
- Be honest — if the answer is poor, say so clearly without being harsh

Respond ONLY with this JSON (no markdown, no extra text):
{
  "feedback": "Overall assessment of the answer quality referencing their actual response",
  "strengths": "What they did well specifically — or 'None' if nothing was good",
  "improvements": "Exactly what was missing or wrong, with specific guidance"
}"""

    user_prompt = f"""Question: {question}

Candidate's Answer: {answer}

Ideal Answer (for reference): {ideal_answer}

Scores: Relevance={scores['relevance']}/10, Technical Depth={scores['technical']}/10, Confidence={scores['confidence']}/10, Communication={scores['communication']}/10, Overall={overall}/10

Give specific, intelligent feedback on this answer."""

    try:
        response = groq_client.chat.completions.create(
            model=FEEDBACK_MODEL,
            max_tokens=500,
            temperature=0.4,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
        )
        raw = response.choices[0].message.content.strip()

        # Strip markdown fences if present
        raw = re.sub(r"```json\s*", "", raw)
        raw = re.sub(r"```\s*", "", raw)

        import json
        parsed = json.loads(raw)
        return {
            "feedback":     parsed.get("feedback", "").strip(),
            "strengths":    parsed.get("strengths", "").strip(),
            "improvements": parsed.get("improvements", "").strip(),
        }
    except Exception as e:
        # Fallback to rule-based if AI fails
        return _rule_based_feedback(scores, overall)


def _rule_based_feedback(scores: dict, overall: float) -> dict:
    """Simple fallback feedback if Groq call fails."""
    if overall >= 8:
        return {
            "feedback": "Strong answer with good depth and clarity.",
            "strengths": "Well-structured response with relevant content.",
            "improvements": "Minor refinements possible but overall solid.",
        }
    elif overall >= 5:
        return {
            "feedback": "Partial answer — covers some aspects but misses key points.",
            "strengths": "Some relevant content included.",
            "improvements": "The answer needs more technical depth and completeness.",
        }
    else:
        return {
            "feedback": "The answer is insufficient — it lacks the substance needed for this question.",
            "strengths": "None clearly demonstrated.",
            "improvements": "A complete answer requires addressing the core of what was asked with specific knowledge.",
        }


# ─── Main evaluation entry point ──────────────────────────────────────────────

def evaluate_answer(answer: str, question: str, ideal_answer: str) -> dict:
    """
    Evaluate a candidate's answer. Returns scores + AI feedback.
    Junk answers (< 5 words, 'ok', 'idk', etc.) get near-zero scores.
    """
    answer = (answer or "").strip()

    # Hard zero for garbage answers
    if is_junk_answer(answer):
        return {
            "relevance":     0.0,
            "technical":     0.0,
            "confidence":    0.0,
            "communication": 0.0,
            "overall":       0.0,
            "feedback":      "This response does not constitute a real answer. A blank, single-word, or meaningless response cannot be evaluated.",
            "strengths":     "None identifiable from this response.",
            "improvements":  "Provide a complete, thoughtful answer. Even a basic attempt would score significantly higher.",
        }

    # Score real answers
    relevance     = score_relevance(answer, question, ideal_answer)
    technical     = score_depth(answer, question)
    confidence    = score_confidence(answer)
    communication = score_communication(answer)

    overall = round(
        (relevance * 0.35) + (technical * 0.35) + (confidence * 0.15) + (communication * 0.15),
        2,
    )

    scores = {
        "relevance":     relevance,
        "technical":     technical,
        "confidence":    confidence,
        "communication": communication,
        "overall":       overall,
    }

    # AI-generated intelligent feedback
    feedback_data = generate_ai_feedback(question, answer, ideal_answer, scores)

    return {**scores, **feedback_data}