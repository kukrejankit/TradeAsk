import { getDb, query } from '../models/database';
import { generateEmbedding, bufferToEmbedding, cosineSimilarity } from './embeddingService';
import { config } from '../config/env';
import { SearchResult } from '../models/types';

export async function searchDocuments(
  queryText: string,
  category?: string,
  topK?: number
): Promise<SearchResult[]> {
  const k = topK || config.rag.topK;
  const queryEmbedding = generateEmbedding(queryText);

  let sql = `
    SELECT c.id, c.document_id, c.chunk_index, c.content, c.section_title,
           c.page_number, c.token_count, c.embedding, c.created_at,
           d.id as doc_id, d.filename, d.file_path, d.file_type, d.file_size,
           d.title, d.category, d.description, d.status, d.error_message,
           d.total_chunks, d.uploaded_by, d.created_at as doc_created_at, d.processed_at
    FROM document_chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE d.status = 'ready' AND c.embedding IS NOT NULL
  `;
  const params: any[] = [];

  if (category) {
    sql += ` AND d.category = ?`;
    params.push(category);
  }

  const rows = await query<any[]>(sql, params);

  const scored: SearchResult[] = [];
  for (const row of rows) {
    if (!row.embedding) continue;
    const chunkEmbedding = bufferToEmbedding(row.embedding);
    const score = cosineSimilarity(queryEmbedding, chunkEmbedding);

    scored.push({
      chunk: {
        id: row.id,
        document_id: row.document_id,
        chunk_index: row.chunk_index,
        content: row.content,
        section_title: row.section_title,
        page_number: row.page_number,
        token_count: row.token_count,
        embedding: null,
        created_at: row.created_at,
      },
      document: {
        id: row.doc_id,
        filename: row.filename,
        file_path: row.file_path,
        file_type: row.file_type,
        file_size: row.file_size,
        title: row.title,
        category: row.category,
        description: row.description,
        status: row.status,
        error_message: row.error_message,
        total_chunks: row.total_chunks,
        uploaded_by: row.uploaded_by,
        created_at: row.doc_created_at,
        processed_at: row.processed_at,
      },
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

export function formatContextForClaude(results: SearchResult[]): string {
  if (results.length === 0) return '';

  let context = 'REFERENCE MATERIAL:\n';
  let totalTokens = 0;

  for (const result of results) {
    const chunkTokens = result.chunk.token_count || 0;
    if (totalTokens + chunkTokens > config.rag.maxContextTokens) break;

    const source = result.document.title || result.document.filename;
    const section = result.chunk.section_title ? `, ${result.chunk.section_title}` : '';
    const page = result.chunk.page_number ? `, p.${result.chunk.page_number}` : '';

    context += `---\n[Source: ${source}${section}${page}]\n${result.chunk.content}\n`;
    totalTokens += chunkTokens;
  }

  return context;
}
