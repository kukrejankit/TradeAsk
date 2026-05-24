import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, insert, update, getDb } from '../models/database';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { config } from '../config/env';

const router = Router();

const docsDir = path.resolve(config.rag.documentsPath);
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, docsDir),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.rag.maxDocSizeMB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (config.rag.allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Accepted: ${config.rag.allowedExtensions.join(', ')}`));
    }
  },
});

router.post('/upload', requireAuth, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const { title, category, description } = req.body;
    const id = uuidv4();

    await insert(
      `INSERT INTO documents (id, filename, file_path, file_type, file_size, title, category, description, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size,
       title || null, category || null, description || null, req.admin!.email]
    );

    await insert(
      `INSERT INTO processing_queue (document_id) VALUES (?)`,
      [id]
    );

    console.log(`Document uploaded: ${req.file.originalname} (${id})`);
    res.status(201).json({ id, message: 'Document uploaded and queued for processing' });
  } catch (error: any) {
    console.error('Document upload failed:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    let sql = 'SELECT * FROM documents ORDER BY created_at DESC';
    const params: any[] = [];

    if (category) {
      sql = 'SELECT * FROM documents WHERE category = ? ORDER BY created_at DESC';
      params.push(category);
    }

    const docs = await query<any[]>(sql, params);
    res.json(docs);
  } catch (error) {
    console.error('Get documents failed:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.get('/stats', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const stats = db.prepare(`
      SELECT
        COUNT(*) as totalDocs,
        SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as readyDocs,
        SUM(CASE WHEN status = 'processing' OR status = 'pending' THEN 1 ELSE 0 END) as processingDocs,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errorDocs,
        SUM(total_chunks) as totalChunks
      FROM documents
    `).get() as any;
    res.json(stats);
  } catch (error) {
    console.error('Document stats failed:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await queryOne<any>('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    res.json(doc);
  } catch (error) {
    console.error('Get document failed:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

router.get('/:id/chunks', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const chunks = await query<any[]>(
      'SELECT id, chunk_index, content, section_title, page_number, token_count FROM document_chunks WHERE document_id = ? ORDER BY chunk_index',
      [req.params.id]
    );
    res.json(chunks);
  } catch (error) {
    console.error('Get chunks failed:', error);
    res.status(500).json({ error: 'Failed to fetch chunks' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await queryOne<any>('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const filePath = path.resolve(docsDir, doc.file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const db = getDb();
    db.prepare('DELETE FROM document_chunks WHERE document_id = ?').run(req.params.id);
    db.prepare('DELETE FROM processing_queue WHERE document_id = ?').run(req.params.id);
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);

    console.log(`Document deleted: ${doc.filename} (${req.params.id})`);
    res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Delete document failed:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

router.post('/:id/reprocess', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const doc = await queryOne<any>('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const db = getDb();
    db.prepare('DELETE FROM document_chunks WHERE document_id = ?').run(req.params.id);
    db.prepare("UPDATE documents SET status = 'pending', error_message = NULL, total_chunks = 0 WHERE id = ?").run(req.params.id);
    db.prepare("INSERT INTO processing_queue (document_id) VALUES (?)").run(req.params.id);

    res.json({ message: 'Document queued for reprocessing' });
  } catch (error) {
    console.error('Reprocess failed:', error);
    res.status(500).json({ error: 'Failed to reprocess document' });
  }
});

export default router;
