# ⚡ InterviewAI – AI Interview Preparation Tool

A full-stack, production-ready mock interview system with AI-powered feedback, webcam + voice support, resume analysis, and detailed performance reports.

---

## 📁 Project Structure

```
ai-interview-tool/
├── backend/
│   ├── main.py               # FastAPI app — all routes
│   ├── auth.py               # JWT auth + password hashing
│   ├── database.py           # MySQL connection pool
│   ├── resume_parser.py      # PDF/DOCX parsing + skill extraction
│   ├── question_generator.py # Interview question generation
│   ├── evaluator.py          # NLP-based answer evaluation
│   ├── schema.sql            # MySQL database schema
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Environment variable template
│
└── frontend/
    ├── public/
    │   └── index.html
    └── src/
        ├── App.js            # Router + protected routes
        ├── index.js          # React entry point
        ├── index.css         # Global styles + design tokens
        ├── context/
        │   └── AuthContext.js  # Global auth state
        ├── utils/
        │   └── api.js          # Axios instance with JWT
        ├── components/
        │   └── Navbar.js       # Top navigation
        └── pages/
            ├── Login.js        # Login page
            ├── Signup.js       # Signup page
            ├── Dashboard.js    # Upload resume / pick role
            ├── Interview.js    # Core interview experience
            ├── Report.js       # Detailed feedback report
            └── History.js      # Past sessions
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 16+
- MySQL 8.0+

---

### 1. Database Setup

```sql
-- In MySQL:
CREATE DATABASE interview_tool;
```

Then run the schema:
```bash
mysql -u root -p interview_tool < backend/schema.sql
```

---

### 2. Backend Setup

```bash
cd backend

# Copy and configure environment
cp .env.example .env
# Edit .env with your MySQL credentials and a strong SECRET_KEY

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download NLTK data (first run only)
python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('averaged_perceptron_tagger')"

# Start the API server
uvicorn main:app --reload --port 8000
```

API is now running at: **http://localhost:8000**
Swagger docs at: **http://localhost:8000/docs**

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start React development server
npm start
```

App is now at: **http://localhost:3000**

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, React Router v6, Axios |
| **Backend** | Python 3, FastAPI, Uvicorn |
| **Database** | MySQL 8 (mysql-connector-python) |
| **Auth** | JWT (python-jose) + bcrypt (passlib) |
| **Resume Parsing** | PyPDF2, python-docx |
| **Speech-to-Text** | Web Speech API (browser-native, free) |
| **NLP Evaluation** | NLTK, scikit-learn (TF-IDF cosine similarity) |
| **Styling** | Custom CSS with CSS variables |

---

## ✨ Features

### 🔐 Authentication
- Secure signup/login with bcrypt password hashing
- JWT-based session management (24-hour tokens)
- Protected routes on both frontend and backend

### 📊 Dashboard
- **Upload Resume**: Parse PDF/DOCX, extract skills, generate tailored questions
- **Start Without Resume**: Choose a target role from presets or enter a custom one

### 🎤 Interview Mode
- Webcam + microphone capture (browser Web Speech API)
- Voice-to-text transcription with live display
- Editable text answer field
- Per-question timer and progress bar
- Real-time AI feedback after each answer

### 🤖 AI Evaluation (4 dimensions, 0–10 each)
| Dimension | Method |
|-----------|--------|
| **Relevance** | TF-IDF cosine similarity vs question + ideal answer |
| **Technical Accuracy** | Keyword overlap between question and answer |
| **Confidence** | Heuristic: filler words, action words, answer length |
| **Communication** | TTR, sentence variety, vocabulary richness |

### 📈 Report System
- Per-question score breakdown with visual bars
- Overall score donut chart
- Identified strengths and improvement areas
- Sample/ideal answers for every question
- Collapsible answer review per question
- Session history with aggregate stats

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login, get JWT |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/session/start-resume` | Upload resume, start session |
| POST | `/api/session/start-role` | Start role-based session |
| POST | `/api/session/submit-answer` | Submit + evaluate answer |
| POST | `/api/session/complete` | Finalize session, get report |
| GET | `/api/session/{id}/report` | Fetch session report |
| GET | `/api/user/history` | All user sessions |

---

## 🧪 Browser Compatibility

Speech recognition (Web Speech API) is supported in:
- ✅ Google Chrome (recommended)
- ✅ Microsoft Edge
- ⚠️ Firefox (partial support)
- ❌ Safari (limited)

> Users can always type answers manually if speech recognition is unavailable.

---

## 📝 Notes for Academic Submission

- All libraries used are **free and open-source** — no paid APIs
- The project runs **fully locally** with no external service dependencies
- Code is well-commented for readability and evaluation
- Architecture follows clean separation of concerns: routing, auth, parsing, evaluation are all separate modules
- Database schema is normalized (users → sessions → questions → answers → reports)

---

## 🔮 Future Enhancements

- [ ] OpenAI/Ollama integration for richer ideal answers
- [ ] Video recording + replay of interview sessions
- [ ] More granular skill taxonomy from resume
- [ ] Email PDF report export
- [ ] Admin dashboard with user analytics
- [ ] Collaborative peer mock interview mode

---

## 👨‍💻 Author

Built as a final-year academic project showcasing full-stack development, AI/NLP integration, and modern UI/UX design.
