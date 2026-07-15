export interface Question {
  id: number;
  created_at: string;
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
  answered_at: string | null;
  email_sent: boolean;
}

export interface AdminStats {
  total: number;
  pending: number;
  answered: number;
  escalated: number;
  correctionNeeded: number;
  addedToKb: number;
}

export interface Expert {
  id: number;
  email: string;
  name: string;
  specialty: string;
  role: string;
  status: string;
  created_at: string;
}

export interface Document {
  id: string;
  filename: string;
  original_name: string;
  category: string;
  status: 'processing' | 'ready' | 'error';
  chunk_count: number;
  uploaded_at: string;
  error?: string;
}
