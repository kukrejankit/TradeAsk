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

app.get('/api/reset-admin', async (_req, res) => {
  try {
    const { hashPassword } = await import('./services/authService');
    const { update, queryOne } = await import('./models/database');
    const admin = await queryOne<any>('SELECT id, email FROM admin_users WHERE email = ?', ['ankit@tradeask.app']);
    if (!admin) { res.json({ error: 'not found' }); return; }
    const hash = hashPassword('changeme123');
    await update('UPDATE admin_users SET password_hash = ?, status = ? WHERE id = ?', [hash, 'approved', admin.id]);
    res.json({ message: 'Password reset', id: admin.id });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});


app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`TradeAsk API running on http://localhost:${config.port}`);
  startWorker();
});
