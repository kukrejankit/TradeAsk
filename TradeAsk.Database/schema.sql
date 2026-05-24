CREATE DATABASE IF NOT EXISTS tradeask;
USE tradeask;

CREATE TABLE questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_email VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  question_text TEXT NOT NULL,
  file_path VARCHAR(500) NULL,
  file_type VARCHAR(50) NULL,
  status ENUM('pending', 'answered', 'escalated') DEFAULT 'pending',
  claude_answer TEXT NULL,
  final_answer TEXT NULL,
  correction_needed BOOLEAN DEFAULT FALSE,
  correction_notes TEXT NULL,
  added_to_kb BOOLEAN DEFAULT FALSE,
  answered_at DATETIME NULL,
  email_sent BOOLEAN DEFAULT FALSE
);

CREATE TABLE admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE knowledge_base (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  question_pattern TEXT NOT NULL,
  answer TEXT NOT NULL,
  source_question_id INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_question_id) REFERENCES questions(id)
);
