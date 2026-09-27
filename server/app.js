import express from 'express';
import cors from 'cors';
import path from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import multer from 'multer';
import { config, rootDir } from './config/env.js';
import { models } from './models/index.js';
import { requireAuth, requireAdminPermission, requireAdminUserManagement } from './middleware/auth.js';
import { ADMIN_PERMISSIONS, sanitizePermissions, hasAdminPermission } from './utilities/permissions.js';
import * as runtime from './services/runtime.js';
import { createRouter as systemRoutes } from './routes/system.js';
import { createRouter as chatbotRoutes } from './routes/chatbot.js';
import { createRouter as customerChatRoutes } from './routes/customerChat.js';
import { createRouter as deliveryChatRoutes } from './routes/deliveryChat.js';
import { createRouter as notificationRoutes } from './routes/notifications.js';
import { createRouter as authRoutes } from './routes/auth.js';
import { createRouter as adminAccountRoutes } from './routes/adminAccounts.js';
import { createRouter as tableRoutes } from './routes/tables.js';
import { createRouter as otpRoutes } from './routes/otp.js';
import { createRouter as uploadRoutes } from './routes/uploads.js';
import { securityHeaders, requestContext, timeoutMiddleware, createRateLimiter } from './middleware/production.js';

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const normalizedOrigin = origin.replace(/\/+$/, '');
  if (config.CLIENT_ORIGINS.length === 0) return true;
  if (config.CLIENT_ORIGINS.includes('*') || config.CLIENT_ORIGINS.includes(normalizedOrigin)) return true;
  try {
    const hostname = new URL(normalizedOrigin).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.onrender.com') || ['cylinder-express.com','www.cylinder-express.com','cylinderexpress.com','www.cylinderexpress.com'].includes(hostname);
  } catch { return false; }
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestContext);
  app.use(securityHeaders);
  app.use(timeoutMiddleware(config.REQUEST_TIMEOUT_MS));
  app.use('/api', createRateLimiter({ windowMs: config.RATE_LIMIT_WINDOW_MS, max: config.RATE_LIMIT_MAX, prefix: 'api' }));
  app.use(['/api/auth', '/api/otp', '/api/password'], createRateLimiter({ windowMs: config.RATE_LIMIT_WINDOW_MS, max: config.AUTH_RATE_LIMIT_MAX, prefix: 'auth' }));
  app.use(cors({ origin(origin, callback) { return isAllowedOrigin(origin) ? callback(null, true) : callback(new Error(`CORS blocked origin: ${origin}`)); }, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use('/uploads', express.static(path.join(rootDir, 'public', 'uploads')));
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'Cylinder Express API', database: mongoose.connection.readyState === 1 ? 'connected' : 'connecting', uptime_seconds: Math.floor(process.uptime()) }));
  app.get('/ready', (_req, res) => mongoose.connection.readyState === 1 ? res.json({ ok: true }) : res.status(503).json({ ok: false, database: 'not_connected' }));

  const ctx = { ...config, ...runtime, models, mongoose, bcrypt, crypto, multer, requireAuth, requireAdminPermission, requireAdminUserManagement, ADMIN_PERMISSIONS, sanitizePermissions, hasAdminPermission };
  for (const factory of [systemRoutes, chatbotRoutes, customerChatRoutes, deliveryChatRoutes, notificationRoutes, authRoutes, adminAccountRoutes, tableRoutes, otpRoutes, uploadRoutes]) app.use(factory(ctx));

  app.use((error, req, res, _next) => {
    console.error(JSON.stringify({ level: 'error', requestId: req.requestId, message: error.message, stack: process.env.NODE_ENV === 'production' ? undefined : error.stack }));
    if (res.headersSent) return;
    const status = error.statusCode || 500;
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : (error.message || 'Request failed'), request_id: req.requestId });
  });
  return app;
}
