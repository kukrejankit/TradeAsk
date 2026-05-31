import { Component, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-public-questions',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './public-questions.html',
})
export class PublicQuestions implements OnInit {
  questions = signal<any[]>([]);
  activeCategory = signal('All');
  loading = signal(false);

  categories = ['All', 'Electrical', 'Plumbing', 'Structural / Building', 'HVAC / Mechanical', 'OSHA & Safety', 'General Construction', 'Other'];

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadQuestions();
  }

  setCategory(cat: string) {
    this.activeCategory.set(cat);
    this.loadQuestions();
  }

  loadQuestions() {
    this.loading.set(true);
    const cat = this.activeCategory() === 'All' ? undefined : this.activeCategory();
    this.api.getPublicQuestions(cat).subscribe({
      next: (q) => { this.questions.set(q); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
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
}
