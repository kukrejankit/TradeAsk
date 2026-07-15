import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import questionsController from './controllers/questionsController';
import adminController from './controllers/adminController';
import chatController from './controllers/chatController';
import filesController from './controllers/filesController';
import documentsController from './controllers/documentsController';
import usersController from './controllers/usersController';
import { startWorker } from './services/processingWorker';

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
const allowedOrigins = config.nodeEnv === 'production'
  ? ['https://tradeask.app', 'https://www.tradeask.app', /\.vercel\.app$/]
  : true;

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

const questionSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many questions submitted. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/questions', questionSubmitLimiter, questionsController);
app.use('/api/chat', chatController);
app.use('/api/admin', adminController);
app.use('/api/admin/documents', documentsController);
app.use('/api/users', usersController);
app.use('/api/files', filesController);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Temporary: reset admin credentials (remove after use)
app.post('/api/reset-admin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }
    const { hashPassword } = await import('./services/authService');
    const { getDb } = await import('./models/database');
    const db = getDb();
    const passwordHash = hashPassword(password);
    const existing = db.prepare('SELECT id FROM admin_users WHERE email = ?').get(email) as any;
    if (existing) {
      db.prepare('UPDATE admin_users SET password_hash = ?, status = ?, role = ? WHERE id = ?')
        .run(passwordHash, 'approved', 'super_admin', existing.id);
      res.json({ message: 'Admin password reset', id: existing.id });
    } else {
      const result = db.prepare('INSERT INTO admin_users (email, password_hash, name, status, role) VALUES (?, ?, ?, ?, ?)')
        .run(email, passwordHash, 'Admin', 'approved', 'super_admin');
      res.json({ message: 'Admin created', id: result.lastInsertRowid });
    }
  } catch (error: any) {
    console.error('Reset admin failed:', error);
    res.status(500).json({ error: error.message });
  }
});



app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`TradeAsk API running on http://localhost:${config.port}`);
  startWorker();
});
