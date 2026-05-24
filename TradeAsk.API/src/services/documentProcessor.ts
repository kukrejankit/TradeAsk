import fs from 'fs';
import path from 'path';
import { insert, update, getDb } from '../models/database';
import { chunkText, chunkDocument, Chunk } from './chunkingService';
import { generateEmbedding, embeddingToBuffer } from './embeddingService';
import { config } from '../config/env';

export async function processDocument(documentId: string): Promise<void> {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId) as any;
  if (!doc) throw new Error(`Document ${documentId} not found`);

  await update("UPDATE documents SET status = 'processing' WHERE id = ?", [documentId]);

  try {
    const fullPath = path.resolve(config.rag.documentsPath, doc.file_path);
    if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${fullPath}`);

    const text = await extractText(fullPath, doc.file_type);
    if (!text || text.trim().length < 10) throw new Error('No text could be extracted from document');

    const pages = [{ text, pageNumber: 1 }];
    const chunks = chunkDocument(pages);

    if (chunks.length === 0) throw new Error('Document produced no chunks');

    console.log(`Processing ${doc.filename}: ${chunks.length} chunks`);

    const insertChunk = db.prepare(`
      INSERT INTO document_chunks (document_id, chunk_index, content, section_title, page_number, token_count, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((chunks: Chunk[]) => {
      for (let i = 0; i < chunks.length; i++) {
        insertChunk.run(
          documentId, i, chunks[i].content,
          chunks[i].sectionTitle, chunks[i].pageNumber,
          chunks[i].tokenCount, null
        );
      }
    });

    insertMany(chunks);

    // Generate embeddings in batches
    const allChunkRows = db.prepare(
      'SELECT id, content FROM document_chunks WHERE document_id = ? ORDER BY chunk_index'
    ).all(documentId) as any[];

    const updateEmbedding = db.prepare('UPDATE document_chunks SET embedding = ? WHERE id = ?');
    for (const row of allChunkRows) {
      const embedding = generateEmbedding(row.content);
      updateEmbedding.run(embeddingToBuffer(embedding), row.id);
    }

    await update(
      "UPDATE documents SET status = 'ready', total_chunks = ?, processed_at = datetime('now') WHERE id = ?",
      [chunks.length, documentId]
    );

    console.log(`Document ${doc.filename} processed: ${chunks.length} chunks embedded`);
  } catch (error: any) {
    await update(
      "UPDATE documents SET status = 'error', error_message = ? WHERE id = ?",
      [error.message, documentId]
    );
    throw error;
  }
}

async function extractText(filePath: string, fileType: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.txt') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
  }

  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  }

  if (['.jpg', '.jpeg', '.png'].includes(ext)) {
    return await ocrWithClaude(filePath, fileType);
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

async function ocrWithClaude(filePath: string, mimeType: string): Promise<string> {
  if (!config.anthropic.apiKey) throw new Error('Anthropic API key required for OCR');

  const imageBuffer = fs.readFileSync(filePath);
  const base64 = imageBuffer.toString('base64');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropic.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: 'Extract all text from this document page exactly as written. Preserve section numbers, article references, and formatting structure.' },
        ],
      }],
    }),
  });

  if (!response.ok) throw new Error(`OCR API error: ${response.status}`);

  const data = await response.json() as any;
  const textBlock = data.content?.find((b: any) => b.type === 'text');
  return textBlock?.text || '';
}
