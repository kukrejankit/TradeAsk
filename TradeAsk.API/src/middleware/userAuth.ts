import { Request, Response, NextFunction } from 'express';
import { verifyFirebaseToken } from '../services/firebaseService';
import { queryOne, insert, update } from '../models/database';

export interface UserRequest extends Request {
  user?: { id: number; email: string; displayName: string | null; firebaseUid: string };
}

export async function optionalUserAuth(req: UserRequest, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.substring(7);
  const decoded = await verifyFirebaseToken(token);
  if (!decoded) {
    next();
    return;
  }

  let user = await queryOne<any>('SELECT * FROM users WHERE firebase_uid = ?', [decoded.uid]);
  if (!user) {
    const id = await insert(
      'INSERT INTO users (firebase_uid, email, display_name, photo_url, auth_provider) VALUES (?, ?, ?, ?, ?)',
      [decoded.uid, decoded.email || '', decoded.name || null, decoded.picture || null, decoded.firebase?.sign_in_provider || 'email']
    );
    user = { id, email: decoded.email, display_name: decoded.name, firebase_uid: decoded.uid };
  } else {
    await update("UPDATE users SET last_login = datetime('now') WHERE id = ?", [user.id]);
  }

  req.user = { id: user.id, email: user.email, displayName: user.display_name, firebaseUid: user.firebase_uid };
  next();
}

export async function requireUserAuth(req: UserRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.substring(7);
  const decoded = await verifyFirebaseToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  let user = await queryOne<any>('SELECT * FROM users WHERE firebase_uid = ?', [decoded.uid]);
  if (!user) {
    const id = await insert(
      'INSERT INTO users (firebase_uid, email, display_name, photo_url, auth_provider) VALUES (?, ?, ?, ?, ?)',
      [decoded.uid, decoded.email || '', decoded.name || null, decoded.picture || null, decoded.firebase?.sign_in_provider || 'email']
    );
    user = { id, email: decoded.email, display_name: decoded.name, firebase_uid: decoded.uid };
  }

  req.user = { id: user.id, email: user.email, displayName: user.display_name, firebaseUid: user.firebase_uid };
  next();
}
