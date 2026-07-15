import fs from 'fs';
import path from 'path';
import { config } from '../config/env';
import { searchDocuments, formatContextForClaude } from './vectorSearchService';
import { query } from '../models/database';

const CHAT_SYSTEM_PROMPT = [
  'You are a knowledgeable expert assistant on ExpertAsk, having a friendly conversation.',
  'You help people with questions across all fields — technology, legal, finance, health, engineering, science, business, and more.',
  '',
  'IMPORTANT RULES FOR YOUR RESPONSES:',
  '- Write in a natural, conversational tone, like texting a knowledgeable colleague.',
  '- Do NOT use markdown formatting. No headings, no bold, no code blocks, no bullet points with dashes, no numbered lists.',
  '- Write in plain flowing paragraphs. Use line breaks between paragraphs for readability.',
  '- Cite specific sources, regulations, or standards when relevant, but weave them naturally into sentences.',
  '- Keep answers concise, under 200 words unless the question genuinely requires more.',
  '- If the user\'s question is vague or needs clarification, ask ONE short clarifying question. Do not attempt to answer until you have enough context. When asking for clarification, just ask the question directly without any other content.',
  '- If you are not certain about something, say so clearly. Never guess on critical matters.',
  '- End substantive answers (not clarifying questions) with: "A human expert will review this answer for accuracy."',
  '',
  'Remember: you are chatting, not writing a document.',
].join('\n');

const SYSTEM_PROMPT = `You are a knowledgeable expert assistant on ExpertAsk.
You help people with questions across all fields — technology, legal, finance, health, engineering, science, business, and more.
Cite specific sources, regulations, or references when relevant.
Answer in clear, accessible language.
If you are not certain about something, say so clearly — never guess on critical matters.
Keep answers under 250 words unless complexity requires more.
Always end your answer with: "A human expert will review this answer for accuracy."`;

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
        model: 'claude-sonnet-5',
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

export async function generateTopicPhrase(question: string, answer: string): Promise<string> {
  if (!config.anthropic.apiKey) {
    return question.split(/\s+/).slice(0, 5).join(' ');
  }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropic.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 30,
        system: 'Generate a short 3-6 word topic phrase summarizing this Q&A. No quotes, no punctuation at end. Examples: "AC wire color codes", "Residential panel upgrade requirements", "OSHA ladder safety rules"',
        messages: [{ role: 'user', content: `Question: ${question}\nAnswer snippet: ${answer.substring(0, 200)}` }],
      }),
    });
    if (!response.ok) return question.split(/\s+/).slice(0, 5).join(' ');
    const data = await response.json() as any;
    const text = data.content?.find((b: any) => b.type === 'text')?.text?.trim();
    return text ? text.substring(0, 60) : question.split(/\s+/).slice(0, 5).join(' ');
  } catch {
    return question.split(/\s+/).slice(0, 5).join(' ');
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
        model: 'claude-sonnet-5',
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
