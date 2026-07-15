import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, Question, AdminStats } from '../../services/api.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboard implements OnInit {
  // Auth state
  isLoggedIn = signal(false);
  userRole = signal<string>('expert');
  loginEmail = signal('');
  loginPassword = signal('');
  loginError = signal('');
  showSignup = signal(false);
  showPassword = signal(false);
  signupName = signal('');
  signupEmail = signal('');
  signupPassword = signal('');
  signupSpecialty = signal('');
  signupSubmitting = signal(false);
  signupSuccess = signal('');

  // Dashboard state
  questions = signal<Question[]>([]);
  stats = signal<AdminStats>({ total: 0, pending: 0, answered: 0, escalated: 0, correctionNeeded: 0, addedToKb: 0 });
  activeFilter = signal<string>('all');
  selectedQuestion = signal<Question | null>(null);
  loading = signal(false);
  toast = signal('');
  activeTab = signal<'questions' | 'experts'>('questions');
  experts = signal<any[]>([]);

  // Edit state
  editAnswer = signal('');
  correctionNeeded = signal(false);
  correctionNotes = signal('');
  addedToKb = signal(false);

  isAdminRoute = signal(false);

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit() {
    this.isAdminRoute.set(this.router.url === '/admin' || this.router.url.startsWith('/admin/'));
    const token = localStorage.getItem('tradeask_token');
    if (token) {
      this.isLoggedIn.set(true);
      this.userRole.set(localStorage.getItem('tradeask_role') || 'expert');
      if (this.isAdminRoute() && this.userRole() !== 'super_admin') {
        this.isLoggedIn.set(false);
        localStorage.removeItem('tradeask_token');
        localStorage.removeItem('tradeask_role');
      } else {
        this.loadData();
      }
    }
  }

  async googleSignIn() {
    this.loginError.set('');
    try {
      const firebase = await this.loadFirebase();
      const auth = firebase.auth();
      const provider = new (firebase as any).auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      const idToken = await result.user!.getIdToken();

      this.api.firebaseLogin(idToken).subscribe({
        next: (res: any) => {
          if (res.token) {
            localStorage.setItem('tradeask_token', res.token);
            this.isLoggedIn.set(true);
            this.loadData();
          } else if (res.status === 'pending') {
            this.loginError.set(res.message || 'Account created. Awaiting admin approval.');
          }
        },
        error: (err) => {
          this.loginError.set(err.error?.error || 'Google sign-in failed');
        },
      });
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        this.loginError.set(err.message || err.code || 'Google sign-in failed. Please try again.');
      }
    }
  }

  private firebaseApp: any = null;
  private async loadFirebase(): Promise<any> {
    if (this.firebaseApp) return this.firebaseApp;
    const firebase = (window as any).firebase;
    if (firebase && firebase.apps?.length) {
      this.firebaseApp = firebase;
      return firebase;
    }

    await this.loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    await this.loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js');

    const fb = (window as any).firebase;
    if (!fb.apps.length) {
      fb.initializeApp(environment.firebase);
    }
    this.firebaseApp = fb;
    return fb;
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  toggleSignup() {
    this.showSignup.set(!this.showSignup());
    this.loginError.set('');
    this.signupSuccess.set('');
  }

  signup() {
    this.loginError.set('');
    this.signupSuccess.set('');

    if (!this.signupName() || !this.signupEmail() || !this.signupPassword()) {
      this.loginError.set('Please fill in all required fields.');
      return;
    }

    this.signupSubmitting.set(true);
    this.api.signup({
      email: this.signupEmail(),
      password: this.signupPassword(),
      name: this.signupName(),
      specialty: this.signupSpecialty(),
    }).subscribe({
      next: (res) => {
        this.signupSuccess.set(res.message);
        this.signupSubmitting.set(false);
      },
      error: (err) => {
        this.loginError.set(err.error?.error || 'Signup failed');
        this.signupSubmitting.set(false);
      },
    });
  }

  login() {
    this.loginError.set('');
    this.api.login(this.loginEmail(), this.loginPassword()).subscribe({
      next: (res: any) => {
        if (this.isAdminRoute() && res.role !== 'super_admin') {
          this.loginError.set('Admin access only. Experts should use /expert to sign in.');
          return;
        }
        localStorage.setItem('tradeask_token', res.token);
        localStorage.setItem('tradeask_role', res.role || 'expert');
        this.userRole.set(res.role || 'expert');
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
    localStorage.removeItem('tradeask_role');
    this.isLoggedIn.set(false);
    this.activeTab.set('questions');
    this.experts.set([]);
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

  routeToExpert() {
    const q = this.selectedQuestion();
    if (!q) return;
    this.api.routeToExpert(q.id).subscribe({
      next: () => {
        this.showToast('Question sent to expert review');
        this.selectedQuestion.set(null);
        this.loadData();
      },
      error: (err) => this.showToast(err.error?.error || 'Failed to route'),
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

  setTab(tab: 'questions' | 'experts') {
    this.activeTab.set(tab);
    if (tab === 'experts') {
      this.loadExperts();
    }
  }

  loadExperts() {
    this.api.getExperts().subscribe({
      next: (e) => this.experts.set(e),
      error: () => this.showToast('Failed to load experts'),
    });
  }

  approveExpert(id: number) {
    this.api.approveExpert(id).subscribe({
      next: () => { this.showToast('Expert approved'); this.loadExperts(); },
      error: () => this.showToast('Failed to approve expert'),
    });
  }

  rejectExpert(id: number) {
    this.api.rejectExpert(id).subscribe({
      next: () => { this.showToast('Expert rejected'); this.loadExperts(); },
      error: () => this.showToast('Failed to reject expert'),
    });
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
