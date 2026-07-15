import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import { query, queryOne, insert, update, getDb } from '../models/database';
import { streamClaudeAnswer, generateTopicPhrase } from '../services/claudeService';
import { requireSession, SessionRequest } from '../middleware/sessionAuth';
import { config } from '../config/env';

const router = Router();

const storage = multer.diskStorage({
  destination: config.upload.path,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `chat-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: config.upload.maxSizeMB * 1024 * 1024 } });

// Create a new chat session
router.post('/session', async (req: Request, res: Response) => {
  try {
    const { email, category } = req.body;
    if (!email || !category) {
      res.status(400).json({ error: 'Email and category are required' });
      return;
    }

    const id = crypto.randomUUID();
    const sessionToken = crypto.randomUUID();

    const db = getDb();
    db.prepare(
      "INSERT INTO chat_sessions (id, session_token, user_email, category) VALUES (?, ?, ?, ?)"
    ).run(id, sessionToken, email, category);

    res.json({ sessionId: id, sessionToken, email, category });
  } catch (error) {
    console.error('Create session failed:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Send message and get streaming AI response
router.post('/message', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const sessionToken = req.headers['x-session-token'] as string || req.body?.sessionToken;
    const content = req.body?.content;

    if (!sessionToken || !content) {
      res.status(400).json({ error: 'Session token and content are required' });
      return;
    }

    const session = await queryOne<any>(
      "SELECT id, user_email, category FROM chat_sessions WHERE session_token = ? AND status = 'active'",
      [sessionToken]
    );
    if (!session) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    // Handle file upload
    let filePath: string | null = null;
    let fileType: string | null = null;
    if (req.file) {
      filePath = req.file.filename;
      fileType = req.file.mimetype;
    }

    // Save user message
    const db = getDb();
    const userMsgResult = db.prepare(
      "INSERT INTO chat_messages (session_id, role, content, message_type, file_path, file_type) VALUES (?, 'user', ?, 'question', ?, ?)"
    ).run(session.id, content, filePath, fileType);

    // Get chat history for context
    const history = db.prepare(
      "SELECT role, content FROM chat_messages WHERE session_id = ? AND role IN ('user', 'assistant') ORDER BY created_at ASC"
    ).all(session.id) as { role: 'user' | 'assistant'; content: string }[];
    // Exclude the message we just inserted (it's the current question)
    const priorHistory = history.slice(0, -1);

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let fullResponse = '';

    try {
      for await (const token of streamClaudeAnswer(session.category, content, priorHistory, filePath, fileType)) {
        fullResponse += token;
        res.write(`event: token\ndata: ${JSON.stringify({ text: token })}\n\n`);
      }
    } catch (streamError) {
      console.error('Stream error:', streamError);
      const errorMsg = 'I apologize, but I encountered an error. Your question has been queued for expert review.';
      fullResponse = errorMsg;
      res.write(`event: error\ndata: ${JSON.stringify({ message: errorMsg })}\n\n`);
    }

    // Detect if this is a clarifying question (not a real answer)
    // A real answer contains the AHJ disclaimer. If it's missing, it's a clarification.
    const trimmed = fullResponse.trim();
    const isClarification = !trimmed.includes('Always verify critical compliance') && !trimmed.includes('local AHJ');

    // Save AI response
    const messageType = isClarification ? 'clarification' : 'answer';
    const aiMsgResult = db.prepare(
      "INSERT INTO chat_messages (session_id, role, content, message_type) VALUES (?, 'assistant', ?, ?)"
    ).run(session.id, fullResponse, messageType);

    // Only create question for expert review if it's a real answer (not clarification)
    let questionId = null;
    if (!isClarification) {
      const questionResult = db.prepare(
        "INSERT INTO questions (user_email, category, question_text, file_path, file_type, claude_answer, status, session_id, chat_message_id) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)"
      ).run(session.user_email, session.category, content, filePath, fileType, fullResponse, session.id, aiMsgResult.lastInsertRowid);
      questionId = questionResult.lastInsertRowid;
    }

    // Set topic from first message if not set yet (AI-generated short phrase)
    const existingSession = db.prepare("SELECT topic FROM chat_sessions WHERE id = ?").get(session.id) as any;
    if (!existingSession?.topic) {
      generateTopicPhrase(content, fullResponse).then(topic => {
        db.prepare("UPDATE chat_sessions SET topic = ?, updated_at = datetime('now') WHERE id = ?").run(topic, session.id);
      }).catch(() => {
        const fallback = content.split(/\s+/).slice(0, 5).join(' ');
        db.prepare("UPDATE chat_sessions SET topic = ?, updated_at = datetime('now') WHERE id = ?").run(fallback, session.id);
      });
    } else {
      db.prepare("UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?").run(session.id);
    }

    // Send done event
    if (isClarification) {
      res.write(`event: done\ndata: ${JSON.stringify({
        messageId: aiMsgResult.lastInsertRowid,
        isClarification: true,
      })}\n\n`);
    } else {
      res.write(`event: done\ndata: ${JSON.stringify({
        messageId: aiMsgResult.lastInsertRowid,
        questionId,
        reviewNote: 'This response is being reviewed by an industry expert. You will be notified when verified.',
      })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('Chat message failed:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process message' });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Internal error' })}\n\n`);
      res.end();
    }
  }
});

// Get all sessions for a token/email
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const token = req.headers['x-session-token'] as string;
    const email = req.query.email as string;

    if (!token && !email) {
      res.status(400).json({ error: 'Session token or email required' });
      return;
    }

    let sessions;
    if (token) {
      const session = await queryOne<any>(
        "SELECT user_email FROM chat_sessions WHERE session_token = ?",
        [token]
      );
      if (!session) {
        res.json([]);
        return;
      }
      sessions = await query<any[]>(
        "SELECT id, category, topic, status, created_at, updated_at FROM chat_sessions WHERE user_email = ? AND status != 'discarded' ORDER BY updated_at DESC",
        [session.user_email]
      );
    } else {
      sessions = await query<any[]>(
        "SELECT id, category, topic, status, created_at, updated_at FROM chat_sessions WHERE user_email = ? AND status != 'discarded' ORDER BY updated_at DESC",
        [email]
      );
    }

    res.json(sessions);
  } catch (error) {
    console.error('Get sessions failed:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get session with messages
router.get('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const token = req.headers['x-session-token'] as string;
    if (!token) {
      res.status(401).json({ error: 'Session token required' });
      return;
    }

    const session = await queryOne<any>(
      "SELECT cs.* FROM chat_sessions cs WHERE cs.id = ? AND cs.session_token = ?",
      [req.params.id, token]
    );

    if (!session) {
      // Allow access if token belongs to same email
      const tokenSession = await queryOne<any>(
        "SELECT user_email FROM chat_sessions WHERE session_token = ?",
        [token]
      );
      const targetSession = await queryOne<any>(
        "SELECT * FROM chat_sessions WHERE id = ? AND user_email = ?",
        [req.params.id, tokenSession?.user_email]
      );
      if (!targetSession) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      const messages = await query<any[]>(
        "SELECT id, role, content, message_type, file_path, file_type, is_expert_reviewed, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
        [req.params.id]
      );
      res.json({ session: targetSession, messages });
      return;
    }

    const messages = await query<any[]>(
      "SELECT id, role, content, message_type, file_path, file_type, is_expert_reviewed, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
      [req.params.id]
    );

    res.json({ session, messages });
  } catch (error) {
    console.error('Get session failed:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Discard session
router.delete('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const token = req.headers['x-session-token'] as string;
    if (!token) {
      res.status(401).json({ error: 'Session token required' });
      return;
    }

    const session = await queryOne<any>(
      "SELECT user_email FROM chat_sessions WHERE session_token = ?",
      [token]
    );
    if (!session) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }

    // Mark session as discarded
    const affected = await update(
      "UPDATE chat_sessions SET status = 'discarded' WHERE id = ? AND user_email = ?",
      [req.params.id, session.user_email]
    );

    if (affected === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Remove pending questions from this session from review queue
    await update(
      "DELETE FROM questions WHERE session_id = ? AND status = 'pending'",
      [req.params.id]
    );

    res.json({ message: 'Session discarded' });
  } catch (error) {
    console.error('Discard session failed:', error);
    res.status(500).json({ error: 'Failed to discard session' });
  }
});

// Identify user by email (retrieve sessions)
router.get('/identify', async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const latestSession = await queryOne<any>(
      "SELECT session_token FROM chat_sessions WHERE user_email = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1",
      [email]
    );

    if (!latestSession) {
      res.json({ found: false });
      return;
    }

    res.json({ found: true, sessionToken: latestSession.session_token });
  } catch (error) {
    console.error('Identify failed:', error);
    res.status(500).json({ error: 'Failed to identify user' });
  }
});

export default router;
