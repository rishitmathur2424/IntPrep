import os
import json
import firebase_admin
from firebase_admin import credentials, firestore

firebase_config = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")

if not firebase_config:
    raise Exception("❌ FIREBASE_CONFIG not found")

try:
    cred = credentials.Certificate(json.loads(firebase_config))
except Exception as e:
    print("🔥 Firebase JSON ERROR:", e)
    raise e

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()

print("✅ Firestore initialized successfully")
