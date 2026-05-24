import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-question-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './question-form.html',
})
export class QuestionForm {
  email = signal('');
  category = signal('');
  questionText = signal('');
  file: File | null = null;
  submitting = signal(false);
  submitted = signal(false);
  submittedEmail = signal('');
  error = signal('');

  categories = [
    'Electrical (NEC)',
    'Plumbing (IPC/UPC)',
    'Structural / Building Code (IBC)',
    'HVAC / Mechanical',
    'Fire & Life Safety',
    'OSHA / Safety',
    'General Construction',
    'Other',
  ];

  constructor(private api: ApiService) {}

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const f = input.files[0];
      if (f.size > 10 * 1024 * 1024) {
        this.error.set('File too large. Maximum size is 10MB.');
        this.file = null;
        return;
      }
      this.file = f;
      this.error.set('');
    }
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      const f = event.dataTransfer.files[0];
      if (f.size > 10 * 1024 * 1024) {
        this.error.set('File too large. Maximum size is 10MB.');
        return;
      }
      this.file = f;
      this.error.set('');
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  removeFile() {
    this.file = null;
  }

  submit() {
    this.error.set('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email())) {
      this.error.set('Please enter a valid email address.');
      return;
    }
    if (!this.category()) {
      this.error.set('Please select a category.');
      return;
    }
    if (this.questionText().length < 10) {
      this.error.set('Question must be at least 10 characters.');
      return;
    }

    this.submitting.set(true);
    const formData = new FormData();
    formData.append('email', this.email());
    formData.append('category', this.category());
    formData.append('questionText', this.questionText());
    if (this.file) {
      formData.append('file', this.file);
    }

    this.api.submitQuestion(formData).subscribe({
      next: () => {
        this.submittedEmail.set(this.email());
        this.submitted.set(true);
        this.submitting.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'Failed to submit question. Please try again.');
        this.submitting.set(false);
      },
    });
  }

  reset() {
    this.submitted.set(false);
    this.email.set('');
    this.category.set('');
    this.questionText.set('');
    this.file = null;
    this.error.set('');
  }
}
