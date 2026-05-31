import { Component, signal, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ChatService, ChatSession, ChatMessage } from '../../services/chat.service';

interface DisplayMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  type: string;
  isExpertReviewed?: boolean;
  isStreaming?: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, SlicePipe],
  templateUrl: './chat.html',
})
export class Chat implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  // Identity state
  userEmail = signal('');
  selectedCategory = signal('');
  isIdentified = signal(false);
  identifyMode = signal<'new' | 'returning'>('new');

  // Chat state
  sessions = signal<ChatSession[]>([]);
  currentSessionId = signal<string | null>(null);
  messages = signal<DisplayMessage[]>([]);
  streamingText = signal('');
  isStreaming = signal(false);
  inputText = signal('');
  file: File | null = null;
  showSidebar = signal(false);
  error = signal('');

  categories = [
    'Electrical',
    'Plumbing',
    'Structural / Building',
    'HVAC / Mechanical',
    'OSHA & Safety',
    'General Construction',
    'Other',
  ];

  private shouldScroll = false;

  constructor(private chatService: ChatService, private route: ActivatedRoute) {}

  ngOnInit() {
    const storedEmail = this.chatService.getStoredEmail();
    const storedToken = this.chatService.getSessionToken();

    if (storedEmail && storedToken) {
      this.userEmail.set(storedEmail);
      this.isIdentified.set(true);
      this.loadSessions();
    }

    const sessionId = this.route.snapshot.paramMap.get('sessionId');
    if (sessionId) {
      this.loadSession(sessionId);
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  async startSession() {
    this.error.set('');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.userEmail())) {
      this.error.set('Please enter a valid email address.');
      return;
    }
    if (!this.selectedCategory()) {
      this.error.set('Please select a category.');
      return;
    }

    try {
      const { sessionId } = await this.chatService.createSession(this.userEmail(), this.selectedCategory());
      this.currentSessionId.set(sessionId);
      this.isIdentified.set(true);
      this.messages.set([]);
      this.loadSessions();
    } catch (e) {
      this.error.set('Failed to start session. Please try again.');
    }
  }

  async retrieveByEmail() {
    this.error.set('');
    const token = await this.chatService.identifyByEmail(this.userEmail());
    if (token) {
      this.isIdentified.set(true);
      this.loadSessions();
    } else {
      this.error.set('No sessions found for this email. Start a new conversation.');
    }
  }

  async loadSessions() {
    const sessions = await this.chatService.getSessions();
    this.sessions.set(sessions);
  }

  async loadSession(id: string) {
    try {
      const { session, messages } = await this.chatService.getSession(id);
      this.currentSessionId.set(id);
      this.selectedCategory.set(session.category);
      this.isIdentified.set(true);
      this.messages.set(messages.map(m => ({
        role: m.role,
        content: m.content,
        type: m.message_type,
        isExpertReviewed: !!m.is_expert_reviewed,
      })));
      this.shouldScroll = true;
    } catch (e) {
      this.error.set('Failed to load session.');
    }
  }

  async sendMessage() {
    const text = this.inputText().trim();
    if (!text || this.isStreaming()) return;

    // If no session yet, create one first
    if (!this.currentSessionId()) {
      if (!this.selectedCategory()) {
        this.error.set('Please select a category first.');
        return;
      }
      try {
        const { sessionId } = await this.chatService.createSession(this.userEmail(), this.selectedCategory());
        this.currentSessionId.set(sessionId);
        this.loadSessions();
      } catch {
        this.error.set('Failed to start session.');
        return;
      }
    }

    // Add user message to display
    this.messages.update(msgs => [...msgs, { role: 'user', content: text, type: 'question' }]);
    this.inputText.set('');
    this.shouldScroll = true;

    // Start streaming
    this.isStreaming.set(true);
    this.streamingText.set('');
    const fileToSend = this.file;
    this.file = null;

    try {
      for await (const event of this.chatService.streamMessage(text, fileToSend || undefined)) {
        if (event.type === 'token') {
          this.streamingText.update(t => t + event.data.text);
          this.shouldScroll = true;
        } else if (event.type === 'done') {
          const responseContent = this.streamingText();
          this.streamingText.set('');

          if (event.data.isClarification) {
            // AI is asking for clarification — show as normal message, no review note
            this.messages.update(msgs => [...msgs, {
              role: 'assistant',
              content: responseContent,
              type: 'clarification',
            }]);
          } else {
            // Real answer — show with review note
            this.messages.update(msgs => [...msgs, {
              role: 'assistant',
              content: responseContent,
              type: 'answer',
            }]);
            this.messages.update(msgs => [...msgs, {
              role: 'system',
              content: event.data.reviewNote,
              type: 'system',
            }]);
          }
        } else if (event.type === 'error') {
          this.messages.update(msgs => [...msgs, {
            role: 'assistant',
            content: event.data.message,
            type: 'answer',
          }]);
          this.streamingText.set('');
        }
      }
    } catch (e) {
      this.messages.update(msgs => [...msgs, {
        role: 'system',
        content: 'Failed to get AI response. Your question has been queued for expert review.',
        type: 'system',
      }]);
      this.streamingText.set('');
    }

    this.isStreaming.set(false);
    this.shouldScroll = true;
  }

  hasAnswer(): boolean {
    return this.messages().some(m => m.type === 'answer');
  }

  async changeQuestion() {
    const id = this.currentSessionId();
    if (!id) return;
    try {
      await this.chatService.discardSession(id);
      this.currentSessionId.set(null);
      this.messages.set([]);
      this.loadSessions();
    } catch {
      this.error.set('Failed to change question.');
    }
  }

  async discardSession() {
    const id = this.currentSessionId();
    if (!id) return;
    try {
      await this.chatService.discardSession(id);
      this.currentSessionId.set(null);
      this.messages.set([]);
      this.selectedCategory.set('');
      this.loadSessions();
    } catch {
      this.error.set('Failed to discard session.');
    }
  }

  newSession() {
    this.currentSessionId.set(null);
    this.messages.set([]);
    this.selectedCategory.set('');
    this.streamingText.set('');
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const f = input.files[0];
      if (f.size > 10 * 1024 * 1024) {
        this.error.set('File too large. Maximum size is 10MB.');
        return;
      }
      this.file = f;
      this.error.set('');
    }
  }

  removeFile() {
    this.file = null;
  }

  onEnterKey(event: Event) {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom() {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
}
