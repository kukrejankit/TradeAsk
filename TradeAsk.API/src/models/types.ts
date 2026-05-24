export interface Question {
  id: number;
  created_at: Date;
  user_email: string;
  category: string;
  question_text: string;
  file_path: string | null;
  file_type: string | null;
  status: 'pending' | 'answered' | 'escalated';
  claude_answer: string | null;
  final_answer: string | null;
  correction_needed: boolean;
  correction_notes: string | null;
  added_to_kb: boolean;
  answered_at: Date | null;
  email_sent: boolean;
}

export interface AdminUser {
  id: number;
  email: string;
  password_hash: string;
  created_at: Date;
}

export interface KnowledgeBaseEntry {
  id: number;
  category: string;
  question_pattern: string;
  answer: string;
  source_question_id: number | null;
  created_at: Date;
}

export interface QuestionSubmission {
  email: string;
  category: string;
  questionText: string;
}

export interface ApproveRequest {
  finalAnswer: string;
  correctionNeeded: boolean;
  correctionNotes?: string;
  addedToKb: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AdminStats {
  total: number;
  pending: number;
  answered: number;
  escalated: number;
  correctionNeeded: number;
  addedToKb: number;
}

export interface Document {
  id: string;
  filename: string;
  file_path: string;
  file_type: string;
  file_size: number;
  title: string | null;
  category: string | null;
  description: string | null;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message: string | null;
  total_chunks: number;
  uploaded_by: string;
  created_at: string;
  processed_at: string | null;
}

export interface DocumentChunk {
  id: number;
  document_id: string;
  chunk_index: number;
  content: string;
  section_title: string | null;
  page_number: number | null;
  token_count: number;
  embedding: Buffer | null;
  created_at: string;
}

export interface SearchResult {
  chunk: DocumentChunk;
  document: Document;
  score: number;
}
