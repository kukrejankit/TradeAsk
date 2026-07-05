import Database from 'better-sqlite3';
import path from 'path';
import { config } from '../config/env';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = config.dbPath || path.resolve(__dirname, '../../tradeask.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now')),
      user_email TEXT NOT NULL,
      category TEXT NOT NULL,
      question_text TEXT NOT NULL,
      file_path TEXT NULL,
      file_type TEXT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'answered', 'escalated', 'expert_review')),
      claude_answer TEXT NULL,
      final_answer TEXT NULL,
      correction_needed INTEGER DEFAULT 0,
      correction_notes TEXT NULL,
      added_to_kb INTEGER DEFAULT 0,
      answered_at TEXT NULL,
      email_sent INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      specialty TEXT,
      status TEXT DEFAULT 'approved' CHECK(status IN ('pending', 'approved', 'rejected')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      question_pattern TEXT NOT NULL,
      answer TEXT NOT NULL,
      source_question_id INTEGER NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (source_question_id) REFERENCES questions(id)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      title TEXT,
      category TEXT,
      description TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'ready', 'error')),
      error_message TEXT,
      total_chunks INTEGER DEFAULT 0,
      uploaded_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS document_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      section_title TEXT,
      page_number INTEGER,
      token_count INTEGER,
      embedding BLOB,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS processing_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      status TEXT DEFAULT 'queued' CHECK(status IN ('queued', 'processing', 'completed', 'failed')),
      attempts INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firebase_uid TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      display_name TEXT,
      photo_url TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'email',
      push_token TEXT,
      push_platform TEXT CHECK(push_platform IN ('ios', 'android', 'web')),
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      session_token TEXT NOT NULL UNIQUE,
      user_email TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'discarded', 'archived')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      message_type TEXT NOT NULL CHECK(message_type IN ('question', 'answer', 'clarification', 'expert_review', 'followup')),
      file_path TEXT NULL,
      file_type TEXT NULL,
      is_expert_reviewed INTEGER DEFAULT 0,
      question_id INTEGER NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_queue_status ON processing_queue(status);
    CREATE INDEX IF NOT EXISTS idx_users_firebase ON users(firebase_uid);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON chat_sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_sessions_email ON chat_sessions(user_email);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);
  `);

  // Migrate admin_users table to add new columns if they don't exist
  const adminCols = db.prepare("PRAGMA table_info(admin_users)").all() as any[];
  const colNames = adminCols.map((c: any) => c.name);
  if (!colNames.includes('name')) {
    db.exec("ALTER TABLE admin_users ADD COLUMN name TEXT");
  }
  if (!colNames.includes('specialty')) {
    db.exec("ALTER TABLE admin_users ADD COLUMN specialty TEXT");
  }
  if (!colNames.includes('status')) {
    db.exec("ALTER TABLE admin_users ADD COLUMN status TEXT DEFAULT 'approved'");
  }
  if (!colNames.includes('firebase_uid')) {
    db.exec("ALTER TABLE admin_users ADD COLUMN firebase_uid TEXT");
  }
  if (!colNames.includes('role')) {
    db.exec("ALTER TABLE admin_users ADD COLUMN role TEXT DEFAULT 'expert'");
  }

  // Migrate chat_sessions for topic
  const sessionCols = db.prepare("PRAGMA table_info(chat_sessions)").all() as any[];
  const sessionColNames = sessionCols.map((c: any) => c.name);
  if (!sessionColNames.includes('topic')) {
    db.exec("ALTER TABLE chat_sessions ADD COLUMN topic TEXT");
  }

  // Migrate questions table for chat support
  const questionCols = db.prepare("PRAGMA table_info(questions)").all() as any[];
  const qColNames = questionCols.map((c: any) => c.name);
  if (!qColNames.includes('session_id')) {
    db.exec("ALTER TABLE questions ADD COLUMN session_id TEXT NULL");
  }
  if (!qColNames.includes('chat_message_id')) {
    db.exec("ALTER TABLE questions ADD COLUMN chat_message_id INTEGER NULL");
  }
}

export async function query<T>(sql: string, params?: any[]): Promise<T> {
  const stmt = getDb().prepare(normalizeSql(sql));
  return stmt.all(...normalizeParams(params)) as T;
}

export async function queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
  const stmt = getDb().prepare(normalizeSql(sql));
  const row = stmt.get(...normalizeParams(params));
  return (row as T) || null;
}

export async function insert(sql: string, params?: any[]): Promise<number> {
  const stmt = getDb().prepare(normalizeSql(sql));
  const result = stmt.run(...normalizeParams(params));
  return result.lastInsertRowid as number;
}

export async function update(sql: string, params?: any[]): Promise<number> {
  const stmt = getDb().prepare(normalizeSql(sql));
  const result = stmt.run(...normalizeParams(params));
  return result.changes;
}

function normalizeSql(sql: string): string {
  return sql
    .replace(/NOW\(\)/gi, "datetime('now')")
    .replace(/TRUE/g, '1')
    .replace(/FALSE/g, '0');
}

function normalizeParams(params?: any[]): any[] {
  if (!params) return [];
  return params.map(p => {
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}
