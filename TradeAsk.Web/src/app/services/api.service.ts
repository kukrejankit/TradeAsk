import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  submitQuestion(formData: FormData): Observable<{ id: number; message: string }> {
    return this.http.post<{ id: number; message: string }>(`${this.baseUrl}/questions`, formData);
  }

  signup(data: { email: string; password: string; name: string; specialty: string }): Observable<{ message: string; id: number }> {
    return this.http.post<{ message: string; id: number }>(`${this.baseUrl}/admin/signup`, data);
  }

  firebaseLogin(idToken: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/admin/firebase-login`, { idToken });
  }

  login(email: string, password: string): Observable<{ token: string; email: string }> {
    return this.http.post<{ token: string; email: string }>(`${this.baseUrl}/admin/login`, { email, password });
  }

  getExperts(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/admin/experts`);
  }

  approveExpert(id: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/admin/experts/${id}/approve`, {});
  }

  rejectExpert(id: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/admin/experts/${id}/reject`, {});
  }

  getQuestions(status?: string): Observable<Question[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<Question[]>(`${this.baseUrl}/admin/questions`, { params });
  }

  getQuestion(id: number): Observable<Question> {
    return this.http.get<Question>(`${this.baseUrl}/admin/questions/${id}`);
  }

  approveQuestion(id: number, data: { finalAnswer: string; correctionNeeded: boolean; correctionNotes?: string; addedToKb: boolean }): Observable<any> {
    return this.http.put(`${this.baseUrl}/admin/questions/${id}/approve`, data);
  }

  escalateQuestion(id: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/admin/questions/${id}/escalate`, {});
  }

  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.baseUrl}/admin/stats`);
  }

  getPublicQuestions(category?: string): Observable<any[]> {
    let params = new HttpParams();
    if (category) params = params.set('category', category);
    return this.http.get<any[]>(`${this.baseUrl}/questions/public`, { params });
  }

  getFileUrl(filename: string): string {
    return `${this.baseUrl}/files/${filename}`;
  }

  // Document management
  uploadDocument(formData: FormData): Observable<{ id: string; message: string }> {
    return this.http.post<{ id: string; message: string }>(`${this.baseUrl}/admin/documents/upload`, formData);
  }

  getDocuments(category?: string): Observable<any[]> {
    let params = new HttpParams();
    if (category) params = params.set('category', category);
    return this.http.get<any[]>(`${this.baseUrl}/admin/documents`, { params });
  }

  getDocument(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/admin/documents/${id}`);
  }

  deleteDocument(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/documents/${id}`);
  }

  reprocessDocument(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/documents/${id}/reprocess`, {});
  }

  getDocumentChunks(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/admin/documents/${id}/chunks`);
  }

  getDocumentStats(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/admin/documents/stats`);
  }
}
