-- AI Interview Preparation Tool - MySQL Schema
-- Run this once to initialize the database

CREATE DATABASE IF NOT EXISTS interview_tool;
USE interview_tool;

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Interview sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    mode ENUM('resume', 'role') NOT NULL,          -- resume-based or role-based
    target_role VARCHAR(100),                       -- e.g., "Software Engineer"
    resume_text TEXT,                               -- extracted resume text
    skills JSON,                                    -- extracted skills list
    status ENUM('pending', 'active', 'completed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Questions generated for each session
CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    question_text TEXT NOT NULL,
    category VARCHAR(50),                           -- e.g., "technical", "behavioral", "intro"
    order_index INT NOT NULL,
    ideal_answer TEXT,                              -- AI-generated sample answer
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- User answers for each question
CREATE TABLE IF NOT EXISTS answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    session_id INT NOT NULL,
    answer_text TEXT,                               -- transcribed/typed answer
    score_relevance FLOAT DEFAULT 0,               -- 0-10 relevance score
    score_technical FLOAT DEFAULT 0,               -- 0-10 technical accuracy
    score_confidence FLOAT DEFAULT 0,              -- 0-10 confidence heuristic
    score_communication FLOAT DEFAULT 0,           -- 0-10 communication quality
    overall_score FLOAT DEFAULT 0,                 -- weighted average
    feedback TEXT,                                 -- per-question feedback
    strengths TEXT,
    improvements TEXT,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Final session report
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT UNIQUE NOT NULL,
    overall_score FLOAT,
    strengths TEXT,
    weaknesses TEXT,
    summary TEXT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
