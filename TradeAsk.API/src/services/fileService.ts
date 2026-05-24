import fs from 'fs';
import path from 'path';
import { config } from '../config/env';

const ALLOWED_EXTENSIONS = config.upload.allowedExtensions;
const MAX_SIZE_BYTES = config.upload.maxSizeMB * 1024 * 1024;

export function validateFile(file: Express.Multer.File): string | null {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`;
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `File too large. Maximum size: ${config.upload.maxSizeMB}MB`;
  }
  return null;
}

export function getFilePath(filename: string): string | null {
  const fullPath = path.resolve(config.upload.path, filename);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  const resolved = path.resolve(fullPath);
  const uploadsDir = path.resolve(config.upload.path);
  if (!resolved.startsWith(uploadsDir)) {
    return null;
  }
  return resolved;
}

export function getUploadDir(): string {
  const dir = path.resolve(config.upload.path);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
