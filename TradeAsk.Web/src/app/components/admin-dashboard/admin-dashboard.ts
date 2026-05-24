import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, Question, AdminStats } from '../../services/api.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboard implements OnInit {
  // Auth state
  isLoggedIn = signal(false);
  loginEmail = signal('');
  loginPassword = signal('');
  loginError = signal('');

  // Dashboard state
  questions = signal<Question[]>([]);
  stats = signal<AdminStats>({ total: 0, pending: 0, answered: 0, escalated: 0, correctionNeeded: 0, addedToKb: 0 });
  activeFilter = signal<string>('all');
  selectedQuestion = signal<Question | null>(null);
  loading = signal(false);
  toast = signal('');

  // Edit state
  editAnswer = signal('');
  correctionNeeded = signal(false);
  correctionNotes = signal('');
  addedToKb = signal(false);

  constructor(private api: ApiService) {}

  ngOnInit() {
    const token = localStorage.getItem('tradeask_token');
    if (token) {
      this.isLoggedIn.set(true);
      this.loadData();
    }
  }

  login() {
    this.loginError.set('');
    this.api.login(this.loginEmail(), this.loginPassword()).subscribe({
      next: (res) => {
        localStorage.setItem('tradeask_token', res.token);
        this.isLoggedIn.set(true);
        this.loadData();
      },
      error: (err) => {
        this.loginError.set(err.error?.error || 'Login failed');
      },
    });
  }

  logout() {
    localStorage.removeItem('tradeask_token');
    this.isLoggedIn.set(false);
  }

  loadData() {
    this.loading.set(true);
    this.api.getStats().subscribe({
      next: (s) => this.stats.set(s),
      error: () => this.handleAuthError(),
    });
    const status = this.activeFilter() === 'all' ? undefined : this.activeFilter();
    this.api.getQuestions(status).subscribe({
      next: (q) => { this.questions.set(q); this.loading.set(false); },
      error: () => this.handleAuthError(),
    });
  }

  setFilter(filter: string) {
    this.activeFilter.set(filter);
    this.selectedQuestion.set(null);
    this.loadData();
  }

  selectQuestion(q: Question) {
    this.selectedQuestion.set(q);
    this.editAnswer.set(q.claude_answer || '');
    this.correctionNeeded.set(false);
    this.correctionNotes.set('');
    this.addedToKb.set(false);
  }

  approve() {
    const q = this.selectedQuestion();
    if (!q) return;
    this.loading.set(true);
    this.api.approveQuestion(q.id, {
      finalAnswer: this.editAnswer(),
      correctionNeeded: this.correctionNeeded(),
      correctionNotes: this.correctionNotes(),
      addedToKb: this.addedToKb(),
    }).subscribe({
      next: (res) => {
        this.showToast(`Answer sent to ${q.user_email}`);
        this.selectedQuestion.set(null);
        this.loadData();
      },
      error: (err) => {
        this.showToast(err.error?.error || 'Approve failed');
        this.loading.set(false);
      },
    });
  }

  escalate() {
    const q = this.selectedQuestion();
    if (!q) return;
    this.api.escalateQuestion(q.id).subscribe({
      next: () => {
        this.showToast('Question escalated');
        this.selectedQuestion.set(null);
        this.loadData();
      },
      error: (err) => this.showToast(err.error?.error || 'Escalate failed'),
    });
  }

  back() {
    this.selectedQuestion.set(null);
  }

  getFileUrl(filePath: string): string {
    return this.api.getFileUrl(filePath);
  }

  timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  private showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }

  private handleAuthError() {
    localStorage.removeItem('tradeask_token');
    this.isLoggedIn.set(false);
    this.loading.set(false);
  }
}
