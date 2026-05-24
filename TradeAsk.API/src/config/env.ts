import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: process.env.DB_PATH || '',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tradeask',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || '',
    fromName: process.env.SENDGRID_FROM_NAME || 'TradeAsk',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiryHours: 24,
  },
  upload: {
    path: process.env.UPLOAD_PATH || 'uploads',
    maxSizeMB: 10,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'],
  },
  rag: {
    documentsPath: process.env.DOCUMENTS_PATH || 'documents',
    embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    embeddingDimensions: 384,
    chunkSize: 800,
    chunkOverlap: 100,
    topK: 5,
    maxContextTokens: 3000,
    maxDocSizeMB: 50,
    allowedExtensions: ['.pdf', '.docx', '.txt', '.jpg', '.jpeg', '.png'],
    allowedTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
    ],
  },
};
