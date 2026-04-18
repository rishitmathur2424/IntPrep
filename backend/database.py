# database.py — Firebase Firestore client
# Replaces MySQL entirely. No SQL, no schema, no connection strings.
#
# Firestore structure:
#   users/          {uid}  → { name, email, password_hash, created_at }
#   sessions/       {sid}  → { user_id, mode, target_role, resume_text, status, ... }
#   sessions/{sid}/questions/{qid} → { question_text, category, order_index, ideal_answer }
#   sessions/{sid}/answers/{qid}   → { answer_text, scores, feedback, ... }
#   reports/        {sid}  → { overall_score, strengths, weaknesses, summary }

import os
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()

# Initialize Firebase Admin SDK once
# FIREBASE_SERVICE_ACCOUNT = path to your downloaded service account JSON file
_sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT", "firebase-service-account.json")

if not firebase_admin._apps:
    cred = credentials.Certificate(_sa_path)
    firebase_admin.initialize_app(cred)

# Firestore client — import this in main.py
db = firestore.client()