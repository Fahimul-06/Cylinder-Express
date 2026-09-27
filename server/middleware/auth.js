import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { models } from '../models/index.js';
import { hasAdminPermission } from '../utilities/permissions.js';

const JWT_SECRET = config.JWT_SECRET;
export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try { req.auth = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
}

export function requireAdminPermission(permission) {
  return async (req, res, next) => {
    try {
      const profile = await models.profiles.findOne({ user_id: req.auth.id });
      if (!hasAdminPermission(profile, permission)) {
        return res.status(403).json({ error: 'You do not have permission to access this feature.' });
      }
      req.adminProfile = profile;
      next();
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };
}

export function requireAdminUserManagement(req, res, next) {
  return requireAdminPermission('users')(req, res, next);
}

