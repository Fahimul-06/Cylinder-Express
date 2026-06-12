import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, '.env'));

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-before-production';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cylinder_express';
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const BULKSMSBD_API_URL = process.env.BULKSMSBD_API_URL || 'https://bulksmsbd.net/api/smsapi';
const BULKSMSBD_API_KEY = process.env.BULKSMSBD_API_KEY || '';
const BULKSMSBD_SENDER_ID = process.env.BULKSMSBD_SENDER_ID || process.env.BULKSMSBD_SENDERID || '';
const SMS_ENABLED = Boolean(BULKSMSBD_API_KEY && BULKSMSBD_SENDER_ID);

app.use(cors({
  origin(origin, callback) {
    if (!origin || CLIENT_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(rootDir, 'public', 'uploads')));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'Cylinder Express API', database: mongoose.connection.readyState === 1 ? 'connected' : 'connecting' });
});

const common = {
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
};
const toJSON = {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    for (const key of ['created_at', 'updated_at', 'valid_from', 'valid_until', 'expires_at']) {
      if (ret[key] instanceof Date) ret[key] = ret[key].toISOString();
    }
    return ret;
  },
};

const UserSchema = new mongoose.Schema({
  email: { type: String, lowercase: true, trim: true, sparse: true },
  phone: { type: String, trim: true, sparse: true },
  password_hash: { type: String, required: true },
}, { toJSON });

const ProfileSchema = new mongoose.Schema({
  user_id: { type: String, required: true, index: true, unique: true },
  full_name: { type: String, required: true },
  phone: { type: String, required: true, index: true },
  email: { type: String, default: null },
  avatar_url: { type: String, default: null },
  is_admin: { type: Boolean, default: false },
  role: { type: String, enum: ['customer', 'admin', 'sub_admin', 'delivery'], default: 'customer', index: true },
  permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
  is_active: { type: Boolean, default: true },
  ...common,
}, { toJSON });

const CategorySchema = new mongoose.Schema({ name: String, slug: String, icon: String, description: String, sort_order: Number, created_at: { type: Date, default: Date.now } }, { toJSON });
const ProductSchema = new mongoose.Schema({ category_id: String, name: String, description: String, price: Number, image_url: String, type: String, company_name: String, size: String, valve_size: String, valve_connection: String, unit: { type: String, default: 'piece' }, is_bestseller: Boolean, is_available: Boolean, sort_order: Number, ...common }, { toJSON });
const AddressSchema = new mongoose.Schema({ user_id: String, label: String, address_line1: String, address_line2: String, city: String, district: String, area: String, postal_code: String, latitude: Number, longitude: Number, is_default: Boolean, ...common }, { toJSON });
const OrderSchema = new mongoose.Schema({ user_id: String, address_id: String, delivery_man_id: { type: String, default: null, index: true }, status: { type: String, default: 'pending' }, total_amount: Number, delivery_fee: Number, floor_number: Number, floor_charge: Number, promo_code: String, discount_amount: Number, notes: String, ...common }, { toJSON });
const OrderItemSchema = new mongoose.Schema({ order_id: String, product_id: String, quantity: Number, unit_price: Number, created_at: { type: Date, default: Date.now } }, { toJSON });
const ServiceBookingSchema = new mongoose.Schema({ user_id: String, product_id: String, address_id: String, status: { type: String, default: 'pending' }, scheduled_date: String, scheduled_time: String, notes: String, ...common }, { toJSON });
const OfferSchema = new mongoose.Schema({ title: String, description: String, badge_text: String, discount_type: String, discount_value: Number, code: String, product_id: String, category_slug: String, bg_from: String, bg_to: String, image_url: String, valid_from: { type: Date, default: Date.now }, valid_until: Date, is_active: Boolean, sort_order: Number, created_at: { type: Date, default: Date.now } }, { toJSON });
const OtpSchema = new mongoose.Schema({ phone: String, otp: String, used: { type: Boolean, default: false }, expires_at: Date, created_at: { type: Date, default: Date.now } }, { toJSON });
const PasswordResetSchema = new mongoose.Schema({ phone: String, token: String, used: { type: Boolean, default: false }, expires_at: Date, created_at: { type: Date, default: Date.now } }, { toJSON });
const CustomerLocationSchema = new mongoose.Schema({ user_id: { type: String, unique: true }, active_order_id: { type: String, default: null, index: true }, latitude: Number, longitude: Number, accuracy: Number, is_sharing: { type: Boolean, default: false }, last_seen: { type: Date, default: Date.now }, updated_at: { type: Date, default: Date.now } }, { toJSON });
const CustomerLocationPointSchema = new mongoose.Schema({ user_id: { type: String, index: true }, order_id: { type: String, default: null, index: true }, latitude: Number, longitude: Number, accuracy: Number, recorded_at: { type: Date, default: Date.now, index: true }, created_at: { type: Date, default: Date.now } }, { toJSON });
const DeliveryLocationSchema = new mongoose.Schema({ user_id: { type: String, unique: true, index: true }, latitude: Number, longitude: Number, accuracy: Number, is_sharing: { type: Boolean, default: false }, last_seen: { type: Date, default: Date.now }, updated_at: { type: Date, default: Date.now } }, { toJSON });
const DeliveryLocationPointSchema = new mongoose.Schema({ user_id: { type: String, index: true }, order_id: { type: String, default: null, index: true }, latitude: Number, longitude: Number, accuracy: Number, recorded_at: { type: Date, default: Date.now, index: true }, created_at: { type: Date, default: Date.now } }, { toJSON });

const models = {
  users: mongoose.model('User', UserSchema),
  profiles: mongoose.model('Profile', ProfileSchema),
  categories: mongoose.model('Category', CategorySchema),
  products: mongoose.model('Product', ProductSchema),
  addresses: mongoose.model('Address', AddressSchema),
  orders: mongoose.model('Order', OrderSchema),
  order_items: mongoose.model('OrderItem', OrderItemSchema),
  service_bookings: mongoose.model('ServiceBooking', ServiceBookingSchema),
  offers: mongoose.model('Offer', OfferSchema),
  otp_verifications: mongoose.model('OtpVerification', OtpSchema),
  password_reset_sessions: mongoose.model('PasswordResetSession', PasswordResetSchema),
  customer_locations: mongoose.model('CustomerLocation', CustomerLocationSchema),
  customer_location_points: mongoose.model('CustomerLocationPoint', CustomerLocationPointSchema),
  delivery_locations: mongoose.model('DeliveryLocation', DeliveryLocationSchema),
  delivery_location_points: mongoose.model('DeliveryLocationPoint', DeliveryLocationPointSchema),
};

function signUser(user) {
  const safe = { id: user.id, email: user.email || null, phone: user.phone || null };
  return { access_token: jwt.sign(safe, JWT_SECRET, { expiresIn: '7d' }), user: safe };
}

const ADMIN_PERMISSIONS = ['dashboard', 'orders', 'products', 'offers', 'locations', 'users'];

function sanitizePermissions(input = {}) {
  return ADMIN_PERMISSIONS.reduce((acc, key) => {
    acc[key] = Boolean(input?.[key]);
    return acc;
  }, {});
}

function hasAdminPermission(profile, permission) {
  if (!profile?.is_admin || profile.is_active === false) return false;
  if (profile.role !== 'sub_admin') return true;
  return Boolean(profile.permissions?.[permission]);
}

async function sendBulkSmsBdMessage(phone, message) {
  if (!SMS_ENABLED) return { sent: false, skipped: true };

  const params = new URLSearchParams({
    api_key: BULKSMSBD_API_KEY,
    senderid: BULKSMSBD_SENDER_ID,
    number: normalizePhoneForSms(phone),
    message,
  });

  const response = await fetch(BULKSMSBD_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`BulkSMSBD request failed with status ${response.status}: ${text}`);
  }
  return { sent: true, provider_response: text };
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try { req.auth = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
}

function requireAdminPermission(permission) {
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

function requireAdminUserManagement(req, res, next) {
  return requireAdminPermission('users')(req, res, next);
}

function normalizeMongoField(field) {
  return field === 'id' ? '_id' : field;
}

function buildMongoQuery(filters = []) {
  const query = {};
  for (const filter of filters) {
    const field = normalizeMongoField(filter.field);
    if (filter.op === 'eq') query[field] = filter.value;
    if (filter.op === 'in') query[field] = { $in: filter.value };
    if (filter.op === 'gte') query[field] = { $gte: new Date(filter.value) };
  }
  return query;
}

function getOptionalAuthUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET).id || null;
  } catch {
    return null;
  }
}

function ensureUserOwnedPayload(table, item, userId) {
  const userOwnedTables = new Set(['addresses', 'orders', 'service_bookings', 'customer_locations', 'customer_location_points', 'delivery_locations', 'delivery_location_points']);
  if (!userOwnedTables.has(table) || !userId || item.user_id) return item;
  return { ...item, user_id: userId };
}

async function decorate(table, rows, select = '') {
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  if (!list.length) return rows;
  if (table === 'products' && select.includes('category:')) {
    const ids = [...new Set(list.map((r) => r.category_id).filter(Boolean))];
    const cats = await models.categories.find({ _id: { $in: ids } });
    const map = new Map(cats.map((c) => [c.id, c.toJSON()]));
    list.forEach((r) => { r.category = map.get(r.category_id) || null; });
  }
  if ((table === 'order_items' || table === 'service_bookings') && select.includes('product:')) {
    const ids = [...new Set(list.map((r) => r.product_id).filter(Boolean))];
    const products = await models.products.find({ _id: { $in: ids } });
    const map = new Map(products.map((p) => [p.id, p.toJSON()]));
    list.forEach((r) => { r.product = map.get(r.product_id) || null; });
  }
  return Array.isArray(rows) ? list : list[0];
}

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body;
    if (!password || !phone || !full_name) return res.status(400).json({ error: 'Name, phone and password are required' });
    if (await models.users.findOne({ $or: [{ email }, { phone }] })) return res.status(409).json({ error: 'Account already exists' });
    const user = await models.users.create({ email, phone, password_hash: await bcrypt.hash(password, 12) });
    const existingProfiles = await models.profiles.countDocuments();
    await models.profiles.create({
      user_id: user.id,
      full_name,
      phone,
      email,
      is_admin: existingProfiles === 0,
      role: existingProfiles === 0 ? 'admin' : 'customer',
      permissions: existingProfiles === 0 ? sanitizePermissions(Object.fromEntries(ADMIN_PERMISSIONS.map((key) => [key, true]))) : {},
      is_active: true,
    });
    const session = signUser(user);
    res.json({ session, user: session.user });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    const value = String(emailOrPhone || '').toLowerCase();
    const user = await models.users.findOne({ $or: [{ email: value }, { phone: emailOrPhone }] });
    if (!user || !(await bcrypt.compare(password || '', user.password_hash))) return res.status(401).json({ error: 'Invalid login credentials' });
    const profile = await models.profiles.findOne({ user_id: user.id });
    if (profile?.is_active === false) return res.status(403).json({ error: 'This account is inactive. Please contact the administrator.' });
    const session = signUser(user);
    res.json({ session, user: session.user });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/auth/session', requireAuth, async (req, res) => {
  const user = await models.users.findById(req.auth.id);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({ session: signUser(user) });
});

app.patch('/api/auth/user', requireAuth, async (req, res) => {
  const update = {};
  if (req.body.email) update.email = String(req.body.email).toLowerCase();
  if (req.body.password) update.password_hash = await bcrypt.hash(req.body.password, 12);
  const user = await models.users.findByIdAndUpdate(req.auth.id, update, { new: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const session = signUser(user);
  res.json({ session, user: session.user });
});

app.post('/api/rpc/get_email_by_phone', async (req, res) => {
  const profile = await models.profiles.findOne({ phone: req.body.p_phone });
  res.json({ data: profile?.email || null, error: null });
});


app.post('/api/admin/subadmins', requireAuth, requireAdminUserManagement, async (req, res) => {
  try {
    const { full_name, phone, password, permissions = {} } = req.body;
    if (!full_name || !phone || !password) return res.status(400).json({ error: 'Name, phone and password are required.' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const normalizedPhone = String(phone).trim();
    const email = `${normalizedPhone.replace(/\D/g, '') || normalizedPhone}@subadmin.cylinderexpress.bd`;
    if (await models.users.findOne({ $or: [{ phone: normalizedPhone }, { email }] })) {
      return res.status(409).json({ error: 'A user with this phone already exists.' });
    }

    const user = await models.users.create({ email, phone: normalizedPhone, password_hash: await bcrypt.hash(password, 12) });
    const profile = await models.profiles.create({
      user_id: user.id,
      full_name,
      phone: normalizedPhone,
      email,
      is_admin: true,
      role: 'sub_admin',
      permissions: sanitizePermissions(permissions),
      is_active: true,
    });

    const smsMessage = `Cylinder Express admin account created. Username: ${normalizedPhone}. Password: ${password}. Login and change your password with OTP.`;
    let sms = { sent: false, skipped: true };
    try {
      sms = await sendBulkSmsBdMessage(normalizedPhone, smsMessage);
    } catch (smsError) {
      console.error('Sub-admin credential SMS failed:', smsError.message);
    }

    res.json({ data: profile.toJSON(), sms, error: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/admin/delivery-men', requireAuth, requireAdminUserManagement, async (req, res) => {
  try {
    const { full_name, phone, password } = req.body;
    if (!full_name || !phone || !password) return res.status(400).json({ error: 'Name, phone and password are required.' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const normalizedPhone = String(phone).trim();
    const email = `${normalizedPhone.replace(/\D/g, '') || normalizedPhone}@delivery.cylinderexpress.bd`;
    if (await models.users.findOne({ $or: [{ phone: normalizedPhone }, { email }] })) {
      return res.status(409).json({ error: 'A user with this phone already exists.' });
    }

    const user = await models.users.create({ email, phone: normalizedPhone, password_hash: await bcrypt.hash(password, 12) });
    const profile = await models.profiles.create({
      user_id: user.id,
      full_name,
      phone: normalizedPhone,
      email,
      is_admin: false,
      role: 'delivery',
      permissions: {},
      is_active: true,
    });

    const smsMessage = `Cylinder Express delivery account created. Username: ${normalizedPhone}. Password: ${password}. Login and share your live location before delivery.`;
    let sms = { sent: false, skipped: true };
    try {
      sms = await sendBulkSmsBdMessage(normalizedPhone, smsMessage);
    } catch (smsError) {
      console.error('Delivery credential SMS failed:', smsError.message);
    }

    res.json({ data: profile.toJSON(), sms, error: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/admin/subadmins/:profileId', requireAuth, requireAdminUserManagement, async (req, res) => {
  try {
    const update = {};
    if (req.body.full_name !== undefined) update.full_name = req.body.full_name;
    if (req.body.phone !== undefined) update.phone = req.body.phone;
    if (req.body.permissions !== undefined) update.permissions = sanitizePermissions(req.body.permissions);
    if (req.body.is_active !== undefined) update.is_active = Boolean(req.body.is_active);
    update.updated_at = new Date();
    const profile = await models.profiles.findByIdAndUpdate(req.params.profileId, update, { new: true });
    if (!profile) return res.status(404).json({ error: 'Sub-admin profile not found.' });
    if (req.body.phone !== undefined) await models.users.findByIdAndUpdate(profile.user_id, { phone: req.body.phone });
    res.json({ data: profile.toJSON(), error: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tables/:table', async (req, res) => {
  try {
    const Model = models[req.params.table];
    if (!Model) return res.status(404).json({ error: 'Unknown table' });
    const { action, filters = [], order, limit, body, single, select, count } = req.body;
    const query = buildMongoQuery(filters);
    let data = null;
    let totalCount = null;

    if (action === 'select') {
      let q = Model.find(query);
      if (order?.field) q = q.sort({ [order.field]: order.ascending ? 1 : -1 });
      if (limit) q = q.limit(limit);
      const docs = await q;
      data = docs.map((d) => d.toJSON());
      totalCount = count ? await Model.countDocuments(query) : null;
      data = await decorate(req.params.table, data, select || '');
    }

    if (action === 'insert') {
      const userId = getOptionalAuthUserId(req);
      const payload = Array.isArray(body) ? body : [body];
      const docs = await Model.insertMany(payload.map((item) => ({
        ...ensureUserOwnedPayload(req.params.table, item, userId),
        updated_at: new Date(),
      })));
      data = docs.map((d) => d.toJSON());
    }

    if (action === 'upsert') {
      const userId = getOptionalAuthUserId(req);
      const payload = Array.isArray(body) ? body : [body];
      const output = [];
      for (const rawItem of payload) {
        const item = ensureUserOwnedPayload(req.params.table, rawItem, userId);
        const { id, ...itemWithoutId } = item;
        const upsertQuery = id ? { _id: id } : item.user_id ? { user_id: item.user_id } : buildMongoQuery(filters);
        const doc = await Model.findOneAndUpdate(upsertQuery, { ...itemWithoutId, updated_at: new Date() }, { new: true, upsert: true, setDefaultsOnInsert: true });
        output.push(doc.toJSON());
      }
      data = output;
    }

    if (action === 'update') {
      await Model.updateMany(query, { ...body, updated_at: new Date() });
      data = (await Model.find(query)).map((d) => d.toJSON());
    }

    if (action === 'delete') {
      const docs = await Model.find(query);
      await Model.deleteMany(query);
      data = docs.map((d) => d.toJSON());
    }

    if (single === 'single' || single === 'maybeSingle') data = Array.isArray(data) ? (data[0] || null) : data;
    res.json({ data, error: null, count: totalCount });
  } catch (error) {
    res.status(500).json({ data: null, error: error.message });
  }
});

function normalizePhoneForSms(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return `88${digits}`;
  if (digits.length === 10 && digits.startsWith('1')) return `880${digits}`;
  return digits;
}

async function sendBulkSmsBdOtp(phone, otp) {
  return sendBulkSmsBdMessage(phone, `Your Cylinder Express OTP is ${otp}. It will expire in 5 minutes.`);
}

app.post('/functions/v1/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required.' });

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await models.otp_verifications.deleteMany({ phone, used: false });
  await models.otp_verifications.create({ phone, otp, expires_at: new Date(Date.now() + 5 * 60 * 1000) });

  try {
    const smsResult = await sendBulkSmsBdOtp(phone, otp);
    if (process.env.NODE_ENV !== 'production') console.log(`Cylinder Express OTP for ${phone}: ${otp}`);
    res.json({
      success: true,
      message: smsResult.sent ? 'OTP sent successfully' : 'Development OTP generated',
      ...(process.env.NODE_ENV !== 'production' ? { otp } : {}),
    });
  } catch (error) {
    console.error('OTP SMS sending failed:', error.message);
    return res.status(502).json({ error: 'OTP could not be sent. Please try again.' });
  }
});

app.post('/functions/v1/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  const record = await models.otp_verifications.findOne({ phone, used: false }).sort({ created_at: -1 });
  if (!record) return res.status(400).json({ error: 'No OTP found for this number. Please request a new one.' });
  if (record.expires_at < new Date()) return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  if (record.otp !== String(otp).trim()) return res.status(400).json({ error: 'Invalid OTP. Please check and try again.' });
  record.used = true; await record.save();
  res.json({ success: true, message: 'Phone verified successfully' });
});

app.post('/functions/v1/verify-reset-otp', async (req, res) => {
  const { phone, otp } = req.body;
  const record = await models.otp_verifications.findOne({ phone, used: false }).sort({ created_at: -1 });
  if (!record || record.otp !== String(otp).trim() || record.expires_at < new Date()) return res.status(400).json({ error: 'Invalid or expired OTP.' });
  record.used = true; await record.save();
  const token = crypto.randomUUID();
  await models.password_reset_sessions.create({ phone, token, expires_at: new Date(Date.now() + 15 * 60 * 1000) });
  res.json({ success: true, reset_token: token });
});

app.post('/functions/v1/reset-password', async (req, res) => {
  const { phone, reset_token, new_password } = req.body;
  const session = await models.password_reset_sessions.findOne({ phone, token: reset_token, used: false });
  if (!session || session.expires_at < new Date()) return res.status(400).json({ error: 'Invalid or expired reset token.' });
  const user = await models.users.findOne({ phone });
  if (!user) return res.status(404).json({ error: 'No account found with this phone number.' });
  user.password_hash = await bcrypt.hash(new_password, 12); await user.save();
  session.used = true; await session.save();
  res.json({ success: true, message: 'Password updated successfully' });
});

const upload = multer({ storage: multer.diskStorage({
  destination(_req, _file, cb) { const dir = path.join(rootDir, 'public', 'uploads'); fs.mkdirSync(dir, { recursive: true }); cb(null, dir); },
  filename(req, file, cb) { const safePath = String(req.body.path || file.originalname).replace(/[^a-zA-Z0-9._/-]/g, '-'); cb(null, safePath.replaceAll('/', '-')); },
})});
app.post('/api/uploads', upload.single('file'), (req, res) => res.json({ path: req.file.filename }));

async function backfillProfileRolesAndPermissions() {
  const profiles = await models.profiles.find({});
  for (const profile of profiles) {
    let changed = false;
    if (!profile.role || profile.role === 'super_admin') {
      profile.role = profile.is_admin ? 'admin' : 'customer';
      changed = true;
    }
    if (profile.is_active === undefined || profile.is_active === null) {
      profile.is_active = true;
      changed = true;
    }
    if (profile.is_admin && profile.role !== 'sub_admin') {
      const fullPermissions = sanitizePermissions(Object.fromEntries(ADMIN_PERMISSIONS.map((key) => [key, true])));
      if (!profile.permissions || Object.keys(profile.permissions || {}).length === 0) {
        profile.permissions = fullPermissions;
        changed = true;
      }
    }
    if (changed) {
      profile.updated_at = new Date();
      await profile.save();
    }
  }
}

async function backfillOrderUserIds() {
  const orders = await models.orders.find({ $or: [{ user_id: { $exists: false } }, { user_id: null }, { user_id: '' }] });
  for (const order of orders) {
    if (!order.address_id) continue;
    const address = await models.addresses.findById(order.address_id).catch(() => null);
    if (!address?.user_id) continue;
    order.user_id = address.user_id;
    order.updated_at = new Date();
    await order.save();
  }
}

async function ensureDefaultCatalog() {
  const categoryDefinitions = [
    { name: 'LPG Cylinders', slug: 'lpg-cylinders', icon: 'Flame', description: 'New and refill LPG gas cylinders', sort_order: 1 },
    { name: 'Stoves & Burners', slug: 'stoves-burners', icon: 'Flame', description: 'Single burner, double burner and full gas stove products', sort_order: 2 },
    { name: 'Accessories', slug: 'accessories', icon: 'Wrench', description: 'Pipes, regulators, risers, valves and safety accessories', sort_order: 3 },
    { name: 'Services', slug: 'services', icon: 'ShieldCheck', description: 'Installation, repair, maintenance and safety services', sort_order: 4 },
  ];

  const categoriesBySlug = {};
  for (const category of categoryDefinitions) {
    const saved = await models.categories.findOneAndUpdate(
      { slug: category.slug },
      { $set: category },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    categoriesBySlug[category.slug] = saved;
  }

  const products = [
    // LPG cylinders
    { category: 'lpg-cylinders', name: 'Bashundhara LPG 12kg Refill', company_name: 'Bashundhara LPG', valve_size: '22mm', valve_connection: 'Pin', description: 'Standard Bashundhara 12kg LPG refill cylinder for household cooking.', price: 1350, type: 'refill', size: '12kg', unit: 'cylinder', is_bestseller: true, sort_order: 1 },
    { category: 'lpg-cylinders', name: 'Omera LPG 12kg Refill', company_name: 'Omera LPG', valve_size: '22mm', valve_connection: 'Pin', description: 'Omera 12kg LPG refill cylinder for home and small business use.', price: 1340, type: 'refill', size: '12kg', unit: 'cylinder', is_bestseller: true, sort_order: 2 },
    { category: 'lpg-cylinders', name: 'Jamuna LPG 12kg Refill', company_name: 'Jamuna LPG', valve_size: '22mm', valve_connection: 'Pin', description: 'Jamuna 12kg LPG refill cylinder with home delivery support.', price: 1340, type: 'refill', size: '12kg', unit: 'cylinder', is_bestseller: false, sort_order: 3 },
    { category: 'lpg-cylinders', name: 'Beximco LPG 12kg Refill', company_name: 'Beximco LPG', valve_size: '22mm', valve_connection: 'Pin', description: 'Beximco 12kg LPG refill cylinder for regular household usage.', price: 1350, type: 'refill', size: '12kg', unit: 'cylinder', is_bestseller: false, sort_order: 4 },
    { category: 'lpg-cylinders', name: 'Petromax LPG 12kg Refill', company_name: 'Petromax LPG', valve_size: '22mm', valve_connection: 'Pin', description: 'Petromax 12kg LPG refill cylinder.', price: 1330, type: 'refill', size: '12kg', unit: 'cylinder', is_bestseller: false, sort_order: 5 },
    { category: 'lpg-cylinders', name: 'Fresh LPG 12kg Refill', company_name: 'Fresh LPG', valve_size: '22mm', valve_connection: 'Pin', description: 'Fresh 12kg LPG refill cylinder.', price: 1340, type: 'refill', size: '12kg', unit: 'cylinder', is_bestseller: false, sort_order: 6 },
    { category: 'lpg-cylinders', name: 'Bashundhara LPG 12kg New Cylinder', company_name: 'Bashundhara LPG', valve_size: '22mm', valve_connection: 'Pin', description: 'New 12kg LPG cylinder package for first-time users.', price: 3200, type: 'new', size: '12kg', unit: 'package', is_bestseller: true, sort_order: 7 },
    { category: 'lpg-cylinders', name: 'Omera LPG 35kg Refill', company_name: 'Omera LPG', valve_size: '22mm', valve_connection: 'Pin', description: 'Large 35kg LPG refill cylinder for restaurants and commercial kitchens.', price: 3900, type: 'refill', size: '35kg', unit: 'cylinder', is_bestseller: false, sort_order: 8 },

    // Stoves and burners
    { category: 'stoves-burners', name: 'Single Burner Gas Stove', description: 'Compact single burner LPG stove for small kitchens and bachelor homes.', price: 950, type: 'new', size: 'single burner', unit: 'piece', is_bestseller: true, sort_order: 20 },
    { category: 'stoves-burners', name: 'Double Burner Gas Stove', description: 'Two-burner LPG gas stove for regular family cooking.', price: 2200, type: 'new', size: 'double burner', unit: 'piece', is_bestseller: true, sort_order: 21 },
    { category: 'stoves-burners', name: 'Glass Top Double Burner Stove', description: 'Premium glass top double burner LPG stove.', price: 3800, type: 'new', size: 'double burner', unit: 'piece', is_bestseller: false, sort_order: 22 },
    { category: 'stoves-burners', name: 'Auto Ignition Gas Stove', description: 'Auto ignition double burner LPG stove for easy daily use.', price: 4500, type: 'new', size: 'double burner', unit: 'piece', is_bestseller: false, sort_order: 23 },
    { category: 'stoves-burners', name: 'Gas Burner Head Replacement', description: 'Replacement burner head for compatible LPG stoves.', price: 450, type: 'new', size: null, unit: 'piece', is_bestseller: false, sort_order: 24 },
    { category: 'stoves-burners', name: 'Burner Stand / Pan Support', description: 'Durable pan support stand for LPG gas stoves.', price: 300, type: 'new', size: null, unit: 'piece', is_bestseller: false, sort_order: 25 },

    // Accessories
    { category: 'accessories', name: 'Gas Regulator', description: 'Standard LPG gas regulator for safe cylinder connection.', price: 550, type: 'new', size: null, unit: 'piece', is_bestseller: true, sort_order: 40 },
    { category: 'accessories', name: 'Premium Safety Regulator', description: 'Heavy-duty safety regulator with better pressure control.', price: 900, type: 'new', size: null, unit: 'piece', is_bestseller: false, sort_order: 41 },
    { category: 'accessories', name: 'Gas Pipe 1 Meter', description: 'Safety LPG gas pipe for regular stove connection.', price: 250, type: 'new', size: '1 meter', unit: 'piece', is_bestseller: false, sort_order: 42 },
    { category: 'accessories', name: 'Gas Pipe 2 Meter', description: 'Longer LPG safety pipe for flexible kitchen setup.', price: 450, type: 'new', size: '2 meter', unit: 'piece', is_bestseller: false, sort_order: 43 },
    { category: 'accessories', name: 'Gas Raiser', description: 'LPG cylinder raiser/stand for safer cylinder placement.', price: 650, type: 'new', size: null, unit: 'piece', is_bestseller: false, sort_order: 44 },
    { category: 'accessories', name: 'Cylinder Stand with Wheels', description: 'Movable LPG cylinder stand with wheels.', price: 750, type: 'new', size: null, unit: 'piece', is_bestseller: false, sort_order: 45 },
    { category: 'accessories', name: 'Gas Lighter', description: 'Kitchen gas lighter for LPG stoves.', price: 120, type: 'new', size: null, unit: 'piece', is_bestseller: false, sort_order: 46 },
    { category: 'accessories', name: 'Hose Clip / Clamp Set', description: 'Metal hose clip set for securing gas pipe connections.', price: 80, type: 'new', size: 'set', unit: 'set', is_bestseller: false, sort_order: 47 },
    { category: 'accessories', name: 'Gas Leak Detector Spray', description: 'Leak detection spray for checking LPG pipe and regulator joints.', price: 350, type: 'new', size: null, unit: 'piece', is_bestseller: false, sort_order: 48 },

    // Services
    { category: 'services', name: 'Cylinder Installation Service', description: 'Professional LPG cylinder installation and first-time connection setup.', price: 300, type: 'service', size: null, unit: 'service', is_bestseller: false, sort_order: 70 },
    { category: 'services', name: 'Gas Stove Installation', description: 'Technician visit for new LPG gas stove setup and connection testing.', price: 350, type: 'service', size: null, unit: 'service', is_bestseller: false, sort_order: 71 },
    { category: 'services', name: 'Burner Cleaning Service', description: 'Cleaning service for weak flame, blocked burner holes and dirty stove heads.', price: 250, type: 'service', size: null, unit: 'service', is_bestseller: false, sort_order: 72 },
    { category: 'services', name: 'Gas Leak Safety Check', description: 'Safety inspection for cylinder, regulator, pipe and stove joints.', price: 300, type: 'service', size: null, unit: 'service', is_bestseller: true, sort_order: 73 },
    { category: 'services', name: 'Regulator Replacement Service', description: 'Technician service for regulator replacement and connection check.', price: 200, type: 'service', size: null, unit: 'service', is_bestseller: false, sort_order: 74 },
    { category: 'services', name: 'Gas Pipe Replacement Service', description: 'Technician service for replacing old or damaged LPG gas pipe.', price: 220, type: 'service', size: null, unit: 'service', is_bestseller: false, sort_order: 75 },
    { category: 'services', name: 'Emergency Gas Support Visit', description: 'Urgent technician visit for LPG connection, leakage or stove issue support.', price: 500, type: 'service', size: null, unit: 'service', is_bestseller: false, sort_order: 76 },
    { category: 'services', name: 'Monthly Kitchen Safety Check', description: 'Monthly safety checkup for home LPG setup, pipe, regulator and stove.', price: 450, type: 'service', size: null, unit: 'service', is_bestseller: false, sort_order: 77 },
  ];

  for (const product of products) {
    const category = categoriesBySlug[product.category];
    if (!category) continue;
    const { category: _category, ...productData } = product;
    const {
      company_name = null,
      size = null,
      valve_size = null,
      valve_connection = null,
      ...insertOnlyProductData
    } = productData;

    await models.products.findOneAndUpdate(
      { name: productData.name },
      {
        $setOnInsert: {
          ...insertOnlyProductData,
          image_url: null,
          is_available: true,
          created_at: new Date(),
        },
        $set: {
          category_id: category.id,
          company_name,
          size,
          valve_size,
          valve_connection,
          updated_at: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  await models.offers.findOneAndUpdate(
    { code: 'FIRST5' },
    {
      $setOnInsert: {
        title: 'First Order Discount',
        description: 'Get 5% off on your first order.',
        badge_text: 'NEW',
        discount_type: 'percentage',
        discount_value: 5,
        code: 'FIRST5',
        bg_from: '#16a34a',
        bg_to: '#0f766e',
        valid_from: new Date(),
        is_active: true,
        sort_order: 1,
        created_at: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

mongoose.connect(MONGODB_URI).then(async () => {
  await ensureDefaultCatalog();
  await backfillProfileRolesAndPermissions();
  await backfillOrderUserIds();
  app.listen(PORT, () => console.log(`Cylinder Express MongoDB API running on http://localhost:${PORT}`));
}).catch((error) => {
  console.error('MongoDB connection failed:', error.message);
  process.exit(1);
});
