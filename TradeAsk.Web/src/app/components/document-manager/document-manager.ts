import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-document-manager',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './document-manager.html',
})
export class DocumentManager implements OnInit {
  documents = signal<any[]>([]);
  stats = signal<any>({ totalDocs: 0, readyDocs: 0, processingDocs: 0, errorDocs: 0, totalChunks: 0 });
  loading = signal(false);
  toast = signal('');
  uploadError = signal('');

  // Upload form
  selectedFile = signal<File | null>(null);
  docTitle = signal('');
  docCategory = signal('');
  docDescription = signal('');
  uploading = signal(false);

  categories = [
    'Electrical (NEC)',
    'Plumbing (IPC/UPC)',
    'OSHA Safety',
    'Building (IBC)',
    'Mechanical (IMC)',
    'Fire (IFC)',
    'General',
  ];

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit() {
    const token = localStorage.getItem('tradeask_token');
    if (!token) {
      this.router.navigate(['/admin']);
      return;
    }
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.api.getDocuments().subscribe({
      next: (docs) => { this.documents.set(docs); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
    this.api.getDocumentStats().subscribe({
      next: (s) => this.stats.set(s),
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile.set(input.files[0]);
      this.uploadError.set('');
    }
  }

  upload() {
    const file = this.selectedFile();
    if (!file) {
      this.uploadError.set('Please select a file');
      return;
    }

    this.uploading.set(true);
    const formData = new FormData();
    formData.append('file', file);
    if (this.docTitle()) formData.append('title', this.docTitle());
    if (this.docCategory()) formData.append('category', this.docCategory());
    if (this.docDescription()) formData.append('description', this.docDescription());

    this.api.uploadDocument(formData).subscribe({
      next: () => {
        this.showToast('Document uploaded — processing started');
        this.selectedFile.set(null);
        this.docTitle.set('');
        this.docCategory.set('');
        this.docDescription.set('');
        this.loadData();
        this.uploading.set(false);
      },
      error: (err) => {
        this.uploadError.set(err.error?.error || 'Upload failed');
        this.uploading.set(false);
      },
    });
  }

  deleteDoc(doc: any) {
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    this.api.deleteDocument(doc.id).subscribe({
      next: () => { this.showToast('Document deleted'); this.loadData(); },
      error: () => this.showToast('Delete failed'),
    });
  }

  reprocess(doc: any) {
    this.api.reprocessDocument(doc.id).subscribe({
      next: () => { this.showToast('Reprocessing started'); this.loadData(); },
      error: () => this.showToast('Reprocess failed'),
    });
  }

  goToAdmin() {
    this.router.navigate(['/admin']);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  private showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
