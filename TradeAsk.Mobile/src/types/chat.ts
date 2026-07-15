export interface ChatSession {
  id: string;
  category: string;
  topic?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_type: string;
  file_path: string | null;
  file_type: string | null;
  is_expert_reviewed: boolean;
  created_at: string;
}

export interface StreamEvent {
  type: string;
  data: any;
}
