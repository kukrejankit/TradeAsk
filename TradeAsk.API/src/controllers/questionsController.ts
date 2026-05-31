import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { insert, query, queryOne, update } from '../models/database';
import { getClaudeAnswer } from '../services/claudeService';
import { validateFile, getUploadDir } from '../services/fileService';
import { config } from '../config/env';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, getUploadDir()),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxSizeMB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (config.upload.allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Accepted: ${config.upload.allowedExtensions.join(', ')}`));
    }
  },
});

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { email, category, questionText } = req.body;

    if (!email || !category || !questionText) {
      res.status(400).json({ error: 'email, category, and questionText are required' });
      return;
    }

    if (questionText.length < 10) {
      res.status(400).json({ error: 'Question must be at least 10 characters' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    let filePath: string | null = null;
    let fileType: string | null = null;

    if (req.file) {
      const validationError = validateFile(req.file);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }
      filePath = req.file.filename;
      fileType = req.file.mimetype;
    }

    const questionId = await insert(
      `INSERT INTO questions (user_email, category, question_text, file_path, file_type, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [email, category, questionText, filePath, fileType]
    );

    console.log(`Question ${questionId} submitted by ${email}`);

    try {
      const claudeAnswer = await getClaudeAnswer(category, questionText, filePath, fileType);
      if (claudeAnswer) {
        await update(
          `UPDATE questions SET claude_answer = ? WHERE id = ?`,
          [claudeAnswer, questionId]
        );
        console.log(`Claude answer saved for question ${questionId}`);
      }
    } catch (aiError) {
      console.error(`Claude API failed for question ${questionId}:`, aiError);
    }

    res.status(200).json({
      id: questionId,
      message: "Your question has been received. You'll get an answer within 1 hour.",
    });
  } catch (error) {
    console.error('Question submission failed:', error);
    res.status(500).json({ error: 'Failed to submit question. Please try again.' });
  }
});

router.get('/public', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    let sql = "SELECT id, category, question_text, status, created_at FROM questions WHERE status = 'pending' OR status = 'escalated'";
    const params: any[] = [];

    if (category && category !== 'All') {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY created_at DESC LIMIT 15';

    const rows = await query<any[]>(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Public questions failed:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

router.get('/status/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const row = await queryOne<any>(
      'SELECT id, status, created_at FROM questions WHERE id = ?',
      [id]
    );
    if (!row) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.json({ id: row.id, status: row.status, createdAt: row.created_at });
  } catch (error) {
    console.error('Status check failed:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

export default router;
