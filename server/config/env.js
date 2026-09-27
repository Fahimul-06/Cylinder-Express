import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const serverDir = path.resolve(__dirname, '..');
export const rootDir = path.resolve(serverDir, '..');

export function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(serverDir, '.env'));

export const config = {
  PORT: Number(process.env.PORT || 5000),
  JWT_SECRET: process.env.JWT_SECRET || 'change-this-secret-before-production',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cylinder_express',
  CLIENT_ORIGINS: (process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGINS || '').split(',').map((v) => v.trim().replace(/\/+$/, '')).filter(Boolean),
  BULKSMSBD_API_URL: process.env.BULKSMSBD_API_URL || 'https://bulksmsbd.net/api/smsapi',
  BULKSMSBD_API_KEY: process.env.BULKSMSBD_API_KEY || '',
  BULKSMSBD_SENDER_ID: process.env.BULKSMSBD_SENDER_ID || process.env.BULKSMSBD_SENDERID || '',
  CHATBOT_API_KEY: process.env.OPENAI_API_KEY || process.env.CHATBOT_API_KEY || '',
  CHATBOT_API_URL: process.env.CHATBOT_API_URL || 'https://api.openai.com/v1/chat/completions',
  CHATBOT_MODEL: process.env.CHATBOT_MODEL || 'gpt-4.1-mini',
  GOOGLE_GEOCODING_API_KEY: process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
  MONGODB_MAX_POOL_SIZE: Number(process.env.MONGODB_MAX_POOL_SIZE || 50),
  MONGODB_MIN_POOL_SIZE: Number(process.env.MONGODB_MIN_POOL_SIZE || 5),
  API_DEFAULT_LIMIT: Number(process.env.API_DEFAULT_LIMIT || 100),
  API_MAX_LIMIT: Number(process.env.API_MAX_LIMIT || 500),
  REQUEST_TIMEOUT_MS: Number(process.env.REQUEST_TIMEOUT_MS || 30000),
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX || 180),
  AUTH_RATE_LIMIT_MAX: Number(process.env.AUTH_RATE_LIMIT_MAX || 25),
  ENABLE_STARTUP_BACKFILLS: String(process.env.ENABLE_STARTUP_BACKFILLS || 'false').toLowerCase() === 'true',
  ADMIN_HEAD_EMAIL: String(process.env.ADMIN_HEAD_EMAIL || 'cyexpress.help@gmail.com').trim().toLowerCase(),
  ADMIN_HEAD_PASSWORD: process.env.ADMIN_HEAD_PASSWORD || '',
  ADMIN_HEAD_FULL_NAME: process.env.ADMIN_HEAD_FULL_NAME || 'Cylinder Express Administration Head',
};
config.SMS_ENABLED = Boolean(config.BULKSMSBD_API_KEY && config.BULKSMSBD_SENDER_ID);
config.CHATBOT_ENABLED = Boolean(config.CHATBOT_API_KEY);
