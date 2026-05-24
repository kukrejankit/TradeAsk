import { Router, Response } from 'express';
import { query, queryOne, update, insert, getDb } from '../models/database';
import { hashPassword, verifyPassword, generateToken } from '../services/authService';
import { sendAnswerEmail } from '../services/emailService';
import { generateEmbedding, embeddingToBuffer } from '../services/embeddingService';
import { sendPushNotification } from '../services/pushService';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { ApproveRequest, LoginRequest } from '../models/types';

const router = Router();

router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const admin = await queryOne<any>(
      'SELECT id, email, password_hash FROM admin_users WHERE email = ?',
      [email]
    );

    if (!admin || !verifyPassword(password, admin.password_hash)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(admin.id, admin.email);
    res.json({ token, email: admin.email });
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

    const emailSent = await sendAnswerEmail(
      question.user_email,
      question.question_text,
      question.category,
      finalAnswer
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
        'Answer Ready',
        `Your ${question.category} question has been answered`,
        { questionId: String(question.id) }
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
