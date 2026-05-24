import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getFilePath } from '../services/fileService';

const router = Router();

router.get('/:filename', requireAuth, (req: AuthRequest, res: Response) => {
  const { filename } = req.params;
  const filePath = getFilePath(filename);

  if (!filePath) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  res.sendFile(filePath);
});

export default router;
