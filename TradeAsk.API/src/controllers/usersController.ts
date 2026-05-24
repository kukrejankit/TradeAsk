import { Router, Response } from 'express';
import { query, queryOne, update } from '../models/database';
import { requireUserAuth, UserRequest } from '../middleware/userAuth';

const router = Router();

router.get('/me', requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const user = await queryOne<any>('SELECT id, email, display_name, photo_url, auth_provider, created_at FROM users WHERE id = ?', [req.user!.id]);
    res.json(user);
  } catch (error) {
    console.error('Get user failed:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.get('/me/questions', requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const questions = await query<any[]>(
      'SELECT id, created_at, category, question_text, status, final_answer, answered_at FROM questions WHERE user_email = ? ORDER BY created_at DESC',
      [req.user!.email]
    );
    res.json(questions);
  } catch (error) {
    console.error('Get user questions failed:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

router.put('/me/push-token', requireUserAuth, async (req: UserRequest, res: Response) => {
  try {
    const { token, platform } = req.body;
    if (!token) {
      res.status(400).json({ error: 'Push token required' });
      return;
    }
    await update(
      'UPDATE users SET push_token = ?, push_platform = ? WHERE id = ?',
      [token, platform || 'android', req.user!.id]
    );
    res.json({ message: 'Push token saved' });
  } catch (error) {
    console.error('Save push token failed:', error);
    res.status(500).json({ error: 'Failed to save push token' });
  }
});

export default router;
