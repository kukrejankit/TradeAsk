import { Request, Response, NextFunction } from 'express';
import { queryOne } from '../models/database';

export interface SessionRequest extends Request {
  session?: { id: string; session_token: string; user_email: string; category: string };
}

export async function requireSession(req: SessionRequest, res: Response, next: NextFunction) {
  const token = req.headers['x-session-token'] as string || req.body?.sessionToken;

  if (!token) {
    res.status(401).json({ error: 'Session token required' });
    return;
  }

  const session = await queryOne<any>(
    "SELECT id, session_token, user_email, category FROM chat_sessions WHERE session_token = ? AND status = 'active'",
    [token]
  );

  if (!session) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.session = session;
  next();
}
