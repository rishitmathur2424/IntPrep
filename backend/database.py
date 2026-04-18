import os, json
import firebase_admin
from firebase_admin import credentials, firestore

firebase_config = os.getenv("FIREBASE_CONFIG")

if not firebase_config:
    raise ValueError("FIREBASE_CONFIG not set")

cred = credentials.Certificate(json.loads(firebase_config))

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()
