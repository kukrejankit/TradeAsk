import fs from 'fs';
import path from 'path';
import { config } from '../config/env';
import { searchDocuments, formatContextForClaude } from './vectorSearchService';
import { query } from '../models/database';

const CHAT_SYSTEM_PROMPT = `You are a construction and trade compliance expert assistant.
You help field workers, site engineers, electricians, plumbers,
and construction tradespeople with compliance, code, and technical questions.
Always cite specific codes, standards, or regulations when possible
(e.g. NEC 2023 Article 210.52, OSHA 1926.405, IBC 2021 Section 1006).
Answer in plain, simple English suitable for a field worker.
If you are not certain about something, say so clearly — never guess
on safety or compliance matters.
If the user's question is too vague or ambiguous to provide a specific compliance answer,
ask ONE concise clarifying question before answering. Only do this when genuinely necessary.
Keep answers under 250 words unless complexity requires more.
Always end your answer with this exact line:
'⚠️ Always verify critical compliance decisions with a licensed professional or your local authority having jurisdiction (AHJ).'`;

const SYSTEM_PROMPT = `You are a construction and trade compliance expert assistant.
You help field workers, site engineers, electricians, plumbers,
and construction tradespeople with compliance, code, and technical questions.
Always cite specific codes, standards, or regulations when possible
(e.g. NEC 2023 Article 210.52, OSHA 1926.405, IBC 2021 Section 1006).
Answer in plain, simple English suitable for a field worker.
If you are not certain about something, say so clearly — never guess
on safety or compliance matters.
Keep answers under 250 words unless complexity requires more.
Always end your answer with this exact line:
'⚠️ Always verify critical compliance decisions with a licensed professional or your local authority having jurisdiction (AHJ).'`;

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: any;
}

export async function getClaudeAnswer(
  category: string,
  questionText: string,
  filePath?: string | null,
  fileType?: string | null
): Promise<string | null> {
  if (!config.anthropic.apiKey) {
    console.warn('Anthropic API key not configured — skipping AI answer');
    return null;
  }

  try {
    const content: any[] = [];

    if (filePath && fileType) {
      const fullPath = path.resolve(config.upload.path, filePath);
      if (fs.existsSync(fullPath)) {
        if (fileType === 'application/pdf') {
          const pdfText = await extractPdfText(fullPath);
          content.push({
            type: 'text',
            text: `Category: ${category}\nQuestion: ${questionText}\n\nThe user has attached a document. Extracted text:\n${pdfText}`,
          });
        } else if (fileType.startsWith('image/')) {
          const imageBuffer = fs.readFileSync(fullPath);
          const base64 = imageBuffer.toString('base64');
          const mediaType = fileType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          });
          content.push({
            type: 'text',
            text: `Category: ${category}\nQuestion: ${questionText}`,
          });
        }
      }
    }

    if (content.length === 0) {
      let ragContext = '';
      try {
        const results = await searchDocuments(questionText, category);
        ragContext = formatContextForClaude(results);

        const kbEntries = await query<any[]>(
          'SELECT question_pattern, answer FROM knowledge_base WHERE category = ? LIMIT 3',
          [category]
        );
        if (kbEntries.length > 0) {
          ragContext += '\nADMIN-CURATED ANSWERS:\n';
          for (const entry of kbEntries) {
            ragContext += `---\nQ: ${entry.question_pattern}\nA: ${entry.answer}\n`;
          }
        }
      } catch (ragError) {
        console.error('RAG retrieval failed (continuing without context):', ragError);
      }

      const questionWithContext = ragContext
        ? `${ragContext}\n---\n\nUSER QUESTION:\nCategory: ${category}\nQuestion: ${questionText}`
        : `Category: ${category}\nQuestion: ${questionText}`;

      content.push({
        type: 'text',
        text: questionWithContext,
      });
    }

    const messages: ClaudeMessage[] = [{ role: 'user', content }];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropic.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Claude API error ${response.status}: ${errorBody}`);
      return null;
    }

    const data = await response.json() as any;
    const textBlock = data.content?.find((b: any) => b.type === 'text');
    return textBlock?.text || null;
  } catch (error) {
    console.error('Claude API call failed:', error);
    return null;
  }
}

export async function* streamClaudeAnswer(
  category: string,
  questionText: string,
  chatHistory: { role: 'user' | 'assistant'; content: string }[],
  filePath?: string | null,
  fileType?: string | null
): AsyncGenerator<string> {
  if (!config.anthropic.apiKey) {
    yield 'AI is not configured. Your question has been queued for expert review.';
    return;
  }

  try {
    const userContent: any[] = [];

    if (filePath && fileType) {
      const fullPath = path.resolve(config.upload.path, filePath);
      if (fs.existsSync(fullPath)) {
        if (fileType === 'application/pdf') {
          const pdfText = await extractPdfText(fullPath);
          userContent.push({
            type: 'text',
            text: `[Attached document text]:\n${pdfText}`,
          });
        } else if (fileType.startsWith('image/')) {
          const imageBuffer = fs.readFileSync(fullPath);
          const base64 = imageBuffer.toString('base64');
          userContent.push({
            type: 'image',
            source: { type: 'base64', media_type: fileType, data: base64 },
          });
        }
      }
    }

    let ragContext = '';
    try {
      const results = await searchDocuments(questionText, category);
      ragContext = formatContextForClaude(results);

      const kbEntries = await query<any[]>(
        'SELECT question_pattern, answer FROM knowledge_base WHERE category = ? LIMIT 3',
        [category]
      );
      if (kbEntries.length > 0) {
        ragContext += '\nADMIN-CURATED ANSWERS:\n';
        for (const entry of kbEntries) {
          ragContext += `---\nQ: ${entry.question_pattern}\nA: ${entry.answer}\n`;
        }
      }
    } catch (ragError) {
      console.error('RAG retrieval failed (continuing without context):', ragError);
    }

    const contextPrefix = ragContext ? `${ragContext}\n---\n\n` : '';
    userContent.push({
      type: 'text',
      text: `${contextPrefix}Category: ${category}\nQuestion: ${questionText}`,
    });

    const messages: ClaudeMessage[] = [
      ...chatHistory.map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userContent },
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropic.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        stream: true,
        system: CHAT_SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Claude streaming error ${response.status}: ${errorBody}`);
      yield 'I apologize, but I am temporarily unable to respond. Your question has been queued for expert review.';
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              yield parsed.delta.text;
            }
          } catch {}
        }
      }
    }
  } catch (error) {
    console.error('Claude streaming failed:', error);
    yield 'I apologize, but I encountered an error. Your question has been queued for expert review.';
  }
}

async function extractPdfText(filePath: string): Promise<string> {
  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text?.substring(0, 5000) || '(Could not extract text from PDF)';
  } catch (error) {
    console.error('PDF extraction failed:', error);
    return '(Could not extract text from PDF)';
  }
}
