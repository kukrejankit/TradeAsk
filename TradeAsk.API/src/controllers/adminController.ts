import crypto from 'crypto';
import { Router, Response } from 'express';
import { query, queryOne, update, insert, getDb } from '../models/database';
import { hashPassword, verifyPassword, generateToken } from '../services/authService';
import { sendAnswerEmail, sendExpertApprovalEmail } from '../services/emailService';
import { verifyFirebaseToken } from '../services/firebaseService';
import { generateEmbedding, embeddingToBuffer } from '../services/embeddingService';
import { sendPushNotification } from '../services/pushService';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { ApproveRequest, LoginRequest } from '../models/types';
import { config } from '../config/env';

const router = Router();

router.post('/signup', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name, specialty } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    const existing = await queryOne<any>(
      'SELECT id FROM admin_users WHERE email = ?',
      [email]
    );
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = hashPassword(password);
    const id = await insert(
      'INSERT INTO admin_users (email, password_hash, name, specialty, status) VALUES (?, ?, ?, ?, ?)',
      [email, passwordHash, name, specialty || null, 'pending']
    );

    res.status(201).json({ message: 'Account created. Awaiting admin approval.', id });
  } catch (error) {
    console.error('Signup failed:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const admin = await queryOne<any>(
      'SELECT id, email, password_hash, status, role FROM admin_users WHERE email = ?',
      [email]
    );

    if (!admin || !verifyPassword(password, admin.password_hash)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (admin.status === 'pending') {
      res.status(403).json({ error: 'Your account is pending approval. You will be notified once approved.' });
      return;
    }

    if (admin.status === 'rejected') {
      res.status(403).json({ error: 'Your account has not been approved.' });
      return;
    }

    const token = generateToken(admin.id, admin.email);
    res.json({ token, email: admin.email, role: admin.role || 'expert' });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/seed', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const existing = await queryOne<any>(
      'SELECT id FROM admin_users WHERE email = ?',
      [email]
    );
    if (existing) {
      res.status(409).json({ error: 'Admin user already exists' });
      return;
    }

    const passwordHash = hashPassword(password);
    const id = await insert(
      'INSERT INTO admin_users (email, password_hash) VALUES (?, ?)',
      [email, passwordHash]
    );

    console.log(`Admin user created: ${email} (id: ${id})`);
    res.status(201).json({ message: 'Admin user created', id });
  } catch (error) {
    console.error('Seed failed:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

router.post('/firebase-login', async (req: AuthRequest, res: Response) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ error: 'Firebase ID token required' });
      return;
    }

    const decoded = await verifyFirebaseToken(idToken);
    if (!decoded) {
      res.status(401).json({ error: 'Invalid Firebase token' });
      return;
    }

    const email = decoded.email;
    const name = decoded.name || decoded.email?.split('@')[0] || 'Expert';
    const photoUrl = decoded.picture || null;
    const firebaseUid = decoded.uid;

    let admin = await queryOne<any>(
      'SELECT id, email, status, firebase_uid FROM admin_users WHERE email = ? OR firebase_uid = ?',
      [email, firebaseUid]
    );

    if (!admin) {
      const passwordHash = hashPassword(crypto.randomUUID());
      const id = await insert(
        'INSERT INTO admin_users (email, password_hash, name, firebase_uid, status) VALUES (?, ?, ?, ?, ?)',
        [email, passwordHash, name, firebaseUid, 'pending']
      );
      res.status(201).json({ message: 'Account created. Awaiting admin approval.', id, status: 'pending' });
      return;
    }

    if (!admin.firebase_uid) {
      await update('UPDATE admin_users SET firebase_uid = ? WHERE id = ?', [firebaseUid, admin.id]);
    }

    if (admin.status === 'pending') {
      res.status(403).json({ error: 'Your account is pending approval. You will be notified once approved.' });
      return;
    }
    if (admin.status === 'rejected') {
      res.status(403).json({ error: 'Your account has not been approved.' });
      return;
    }

    const token = generateToken(admin.id, admin.email);
    res.json({ token, email: admin.email, name, photoUrl });
  } catch (error) {
    console.error('Firebase login failed:', error);
    res.status(500).json({ error: 'Firebase login failed' });
  }
});

router.post('/forgot-password', async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const admin = await queryOne<any>(
      'SELECT id, email, name FROM admin_users WHERE email = ?',
      [email]
    );

    if (!admin) {
      res.status(404).json({ error: 'No account found with this email address' });
      return;
    }

    const resetToken = crypto.randomUUID();
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await update(
      'UPDATE admin_users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
      [resetToken, expiry, admin.id]
    );

    const resetLink = `https://tradeask.app/reset-password?token=${resetToken}`;

    if (config.sendgrid.apiKey) {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(config.sendgrid.apiKey);
      await sgMail.send({
        to: email,
        from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
        subject: 'TradeAsk — Reset your password',
        html: `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #111827;">Reset your password</h2>
          <p style="color: #6b7280;">Click the link below to reset your password. This link expires in 1 hour.</p>
          <a href="${resetLink}" style="display: inline-block; background: #1a73e8; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">Reset password →</a>
          <p style="color: #9ca3af; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
        </div>`,
      });
    }

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password failed:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

router.post('/reset-password', async (req: AuthRequest, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ error: 'Token and new password are required' });
      return;
    }

    const admin = await queryOne<any>(
      'SELECT id, reset_token_expiry FROM admin_users WHERE reset_token = ?',
      [token]
    );

    if (!admin) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    if (new Date(admin.reset_token_expiry) < new Date()) {
      res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
      return;
    }

    const passwordHash = hashPassword(password);
    await update(
      'UPDATE admin_users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
      [passwordHash, admin.id]
    );

    res.json({ message: 'Password has been reset. You can now log in.' });
  } catch (error) {
    console.error('Reset password failed:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.get('/questions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    let sql = 'SELECT * FROM questions ORDER BY created_at DESC';
    const params: any[] = [];

    if (status) {
      sql = 'SELECT * FROM questions WHERE status = ? ORDER BY created_at DESC';
      params.push(status);
    }

    const rows = await query<any[]>(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Get questions failed:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

router.get('/questions/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const row = await queryOne<any>(
      'SELECT * FROM questions WHERE id = ?',
      [req.params.id]
    );
    if (!row) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.json(row);
  } catch (error) {
    console.error('Get question failed:', error);
    res.status(500).json({ error: 'Failed to fetch question' });
  }
});

router.put('/questions/:id/approve', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { finalAnswer, correctionNeeded, correctionNotes, addedToKb } = req.body as ApproveRequest;
    if (!finalAnswer) {
      res.status(400).json({ error: 'finalAnswer is required' });
      return;
    }

    const question = await queryOne<any>(
      'SELECT * FROM questions WHERE id = ?',
      [req.params.id]
    );
    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }

    await update(
      `UPDATE questions SET
        final_answer = ?,
        status = 'answered',
        correction_needed = ?,
        correction_notes = ?,
        added_to_kb = ?,
        answered_at = NOW()
      WHERE id = ?`,
      [finalAnswer, correctionNeeded || false, correctionNotes || null, addedToKb || false, req.params.id]
    );

    // Add expert-reviewed message to chat session if linked
    if (question.session_id) {
      try {
        const db = getDb();
        const wasChanged = finalAnswer.trim() !== (question.claude_answer || '').trim();
        const reviewContent = wasChanged
          ? finalAnswer
          : '✓ The above response has been reviewed and approved by an industry expert.';
        db.prepare(
          "INSERT INTO chat_messages (session_id, role, content, message_type, is_expert_reviewed, question_id) VALUES (?, ?, ?, 'expert_review', 1, ?)"
        ).run(question.session_id, wasChanged ? 'assistant' : 'system', reviewContent, question.id);
      } catch (chatErr) {
        console.error('Failed to write to chat session (non-critical):', chatErr);
      }
    }

    const chatLink = question.session_id
      ? `https://tradeask.app/chat/${question.session_id}`
      : 'https://tradeask.app';

    const emailSent = await sendAnswerEmail(
      question.user_email,
      question.question_text,
      question.category,
      finalAnswer,
      chatLink,
      correctionNeeded || false
    );

    if (emailSent) {
      await update('UPDATE questions SET email_sent = TRUE WHERE id = ?', [req.params.id]);
    }

    if (addedToKb) {
      await insert(
        'INSERT INTO knowledge_base (category, question_pattern, answer, source_question_id) VALUES (?, ?, ?, ?)',
        [question.category, question.question_text, finalAnswer, question.id]
      );

      try {
        const kbText = `Question: ${question.question_text}\nAnswer: ${finalAnswer}`;
        const embedding = generateEmbedding(kbText);
        const db = getDb();
        db.prepare(`
          INSERT INTO document_chunks (document_id, chunk_index, content, section_title, token_count, embedding)
          VALUES ('kb-corrections', 0, ?, ?, ?, ?)
        `).run(kbText, `Correction: ${question.category}`, Math.ceil(kbText.length / 4), embeddingToBuffer(embedding));
      } catch (embError) {
        console.error('KB embedding failed (non-critical):', embError);
      }
    }

    try {
      await sendPushNotification(
        question.user_email,
        'Expert-Reviewed Answer Ready',
        `Your ${question.category} question has been reviewed by an expert`,
        { questionId: String(question.id), sessionId: question.session_id || '', chatLink }
      );
    } catch (pushError) {
      console.error('Push notification failed (non-critical):', pushError);
    }

    console.log(`Question ${req.params.id} approved by admin`);
    res.json({ message: 'Answer approved and sent', emailSent });
  } catch (error) {
    console.error('Approve failed:', error);
    res.status(500).json({ error: 'Failed to approve answer' });
  }
});

router.put('/questions/:id/escalate', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const affected = await update(
      "UPDATE questions SET status = 'escalated' WHERE id = ?",
      [req.params.id]
    );
    if (affected === 0) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    console.log(`Question ${req.params.id} escalated`);
    res.json({ message: 'Question escalated' });
  } catch (error) {
    console.error('Escalate failed:', error);
    res.status(500).json({ error: 'Failed to escalate question' });
  }
});

router.put('/questions/:id/route-to-expert', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const affected = await update(
      "UPDATE questions SET status = 'expert_review' WHERE id = ?",
      [req.params.id]
    );
    if (affected === 0) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    console.log(`Question ${req.params.id} routed to expert review`);
    res.json({ message: 'Question sent to expert review' });
  } catch (error) {
    console.error('Route to expert failed:', error);
    res.status(500).json({ error: 'Failed to route question' });
  }
});

router.get('/experts', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const experts = await query<any[]>(
      'SELECT id, email, name, specialty, status, created_at FROM admin_users ORDER BY created_at DESC'
    );
    res.json(experts);
  } catch (error) {
    console.error('Get experts failed:', error);
    res.status(500).json({ error: 'Failed to fetch experts' });
  }
});

router.put('/experts/:id/approve', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const expert = await queryOne<any>(
      'SELECT id, email, name FROM admin_users WHERE id = ?',
      [req.params.id]
    );
    if (!expert) {
      res.status(404).json({ error: 'Expert not found' });
      return;
    }

    await update(
      "UPDATE admin_users SET status = 'approved' WHERE id = ?",
      [req.params.id]
    );

    await sendExpertApprovalEmail(expert.email, expert.name || 'Expert');

    res.json({ message: 'Expert approved and notified' });
  } catch (error) {
    console.error('Approve expert failed:', error);
    res.status(500).json({ error: 'Failed to approve expert' });
  }
});

router.put('/experts/:id/reject', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const affected = await update(
      "UPDATE admin_users SET status = 'rejected' WHERE id = ?",
      [req.params.id]
    );
    if (affected === 0) {
      res.status(404).json({ error: 'Expert not found' });
      return;
    }
    res.json({ message: 'Expert rejected' });
  } catch (error) {
    console.error('Reject expert failed:', error);
    res.status(500).json({ error: 'Failed to reject expert' });
  }
});

router.get('/stats', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const [stats] = await query<any[]>(`
      SELECT
        COUNT(*) as total,
        SUM(status = 'pending') as pending,
        SUM(status = 'answered') as answered,
        SUM(status = 'escalated') as escalated,
        SUM(correction_needed = TRUE) as correctionNeeded,
        SUM(added_to_kb = TRUE) as addedToKb
      FROM questions
    `);
    res.json(stats);
  } catch (error) {
    console.error('Stats failed:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
