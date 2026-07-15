import { API_URL } from './config';

export interface PublicQuestion {
  id: number;
  category: string;
  question_text: string;
  status: string;
  created_at: string;
}

export const publicService = {
  async getPublicQuestions(category?: string): Promise<PublicQuestion[]> {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    const res = await fetch(`${API_URL}/questions/public${params}`);
    if (!res.ok) throw new Error('Failed to fetch public questions');
    return res.json();
  },
};
