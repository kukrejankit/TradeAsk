import { config } from '../config/env';

export interface Chunk {
  content: string;
  sectionTitle: string | null;
  pageNumber: number | null;
  tokenCount: number;
}

const SECTION_PATTERNS = [
  /^(Article\s+\d+[\w.]*\s*[-–—]?\s*.+)/im,
  /^(Section\s+\d+[\w.]*\s*[-–—]?\s*.+)/im,
  /^(Chapter\s+\d+\s*[-–—]?\s*.+)/im,
  /^(\d{4}\.\d+\s*[-–—]?\s*.+)/im,
  /^(Subpart\s+[A-Z]\s*[-–—]?\s*.+)/im,
  /^(Exception(?:\s+No\.)?\s*\d+)/im,
  /^(Table\s+\d+[\w.]*)/im,
];

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function detectSectionTitle(text: string): string | null {
  const firstLine = text.split('\n')[0].trim();
  for (const pattern of SECTION_PATTERNS) {
    const match = firstLine.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function splitBySections(text: string): { title: string | null; content: string }[] {
  const combinedPattern = /^(?=Article\s+\d|Section\s+\d|Chapter\s+\d|\d{4}\.\d|Subpart\s+[A-Z])/im;
  const parts = text.split(combinedPattern).filter(p => p.trim().length > 0);

  if (parts.length <= 1) return [{ title: null, content: text }];

  return parts.map(part => ({
    title: detectSectionTitle(part),
    content: part.trim(),
  }));
}

function fixedSizeChunk(text: string, maxTokens: number, overlapTokens: number): string[] {
  const words = text.split(/\s+/);
  const chunkWords = maxTokens * 4;
  const overlapWords = overlapTokens * 4;
  const chunks: string[] = [];

  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkWords, words.length);
    chunks.push(words.slice(start, end).join(' '));
    if (end >= words.length) break;
    start = end - overlapWords;
  }

  return chunks;
}

export function chunkText(text: string, pageNumber?: number): Chunk[] {
  const { chunkSize, chunkOverlap } = config.rag;
  const chunks: Chunk[] = [];
  const sections = splitBySections(text);

  for (const section of sections) {
    const tokens = estimateTokens(section.content);

    if (tokens <= chunkSize) {
      chunks.push({
        content: section.content,
        sectionTitle: section.title,
        pageNumber: pageNumber || null,
        tokenCount: tokens,
      });
    } else {
      const subChunks = fixedSizeChunk(section.content, chunkSize, chunkOverlap);
      for (const sub of subChunks) {
        chunks.push({
          content: sub,
          sectionTitle: section.title,
          pageNumber: pageNumber || null,
          tokenCount: estimateTokens(sub),
        });
      }
    }
  }

  return chunks;
}

export function chunkDocument(pages: { text: string; pageNumber: number }[]): Chunk[] {
  const allChunks: Chunk[] = [];
  for (const page of pages) {
    const pageChunks = chunkText(page.text, page.pageNumber);
    allChunks.push(...pageChunks);
  }
  return allChunks;
}
