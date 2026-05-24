import { getDb, update } from '../models/database';
import { processDocument } from './documentProcessor';

let workerInterval: NodeJS.Timeout | null = null;

export function startWorker() {
  if (workerInterval) return;

  console.log('Document processing worker started');
  workerInterval = setInterval(pollQueue, 5000);
}

export function stopWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}

async function pollQueue() {
  try {
    const db = getDb();
    const job = db.prepare(`
      SELECT * FROM processing_queue
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
    `).get() as any;

    if (!job) return;

    db.prepare(`
      UPDATE processing_queue
      SET status = 'processing', started_at = datetime('now'), attempts = attempts + 1
      WHERE id = ?
    `).run(job.id);

    try {
      await processDocument(job.document_id);
      db.prepare(`
        UPDATE processing_queue
        SET status = 'completed', completed_at = datetime('now')
        WHERE id = ?
      `).run(job.id);
    } catch (error: any) {
      console.error(`Processing failed for document ${job.document_id}:`, error.message);
      const newStatus = job.attempts >= 2 ? 'failed' : 'queued';
      db.prepare(`
        UPDATE processing_queue
        SET status = ?, error_message = ?
        WHERE id = ?
      `).run(newStatus, error.message, job.id);
    }
  } catch (error) {
    console.error('Worker poll error:', error);
  }
}
