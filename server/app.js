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
import { registerChatRoutes } from './routes/chat.routes.js';
import { registerNotificationRoutes } from './routes/notification.routes.js';
import { registerAuthRoutes } from './routes/auth.routes.js';
import { registerTableRoutes } from './routes/table.routes.js';
import { registerOtpRoutes } from './routes/otp.routes.js';
import { registerUploadRoutes } from './routes/upload.routes.js';

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
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const BULKSMSBD_API_URL = process.env.BULKSMSBD_API_URL || 'https://bulksmsbd.net/api/smsapi';
const BULKSMSBD_API_KEY = process.env.BULKSMSBD_API_KEY || '';
const BULKSMSBD_SENDER_ID = process.env.BULKSMSBD_SENDER_ID || process.env.BULKSMSBD_SENDERID || '';
const SMS_ENABLED = Boolean(BULKSMSBD_API_KEY && BULKSMSBD_SENDER_ID);
const CHATBOT_API_KEY = process.env.OPENAI_API_KEY || process.env.CHATBOT_API_KEY || '';
const CHATBOT_API_URL = process.env.CHATBOT_API_URL || 'https://api.openai.com/v1/chat/completions';
const CHATBOT_MODEL = process.env.CHATBOT_MODEL || 'gpt-4.1-mini';
const GOOGLE_GEOCODING_API_KEY = process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';

async function geocodeDeliveryBase(permanentAddress, permanentPlusCode) {
  const query = [permanentPlusCode, permanentAddress].map((value) => String(value || '').trim()).filter(Boolean).join(', ');
  if (!query) return null;
  if (!GOOGLE_GEOCODING_API_KEY) {
    const error = new Error('Google Geocoding API key is missing. Add GOOGLE_GEOCODING_API_KEY to the backend environment.');
    error.statusCode = 503;
    throw error;
  }
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=bd&key=${encodeURIComponent(GOOGLE_GEOCODING_API_KEY)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Google geocoding request failed (${response.status}).`);
  const payload = await response.json();
  if (payload.status !== 'OK' || !payload.results?.[0]?.geometry?.location) {
    const message = payload.error_message || `Base point could not be found (${payload.status || 'unknown status'}).`;
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  }
  const result = payload.results[0];
  return {
    latitude: Number(result.geometry.location.lat),
    longitude: Number(result.geometry.location.lng),
    formattedAddress: result.formatted_address || permanentAddress || permanentPlusCode,
  };
}
const CHATBOT_ENABLED = Boolean(CHATBOT_API_KEY);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const normalizedOrigin = origin.replace(/\/+$/, '');
  if (CLIENT_ORIGINS.length === 0) return true;
  if (CLIENT_ORIGINS.includes('*') || CLIENT_ORIGINS.includes(normalizedOrigin)) return true;
  try {
    const url = new URL(normalizedOrigin);
    const hostname = url.hostname.toLowerCase();
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname.endsWith('.onrender.com')
      || hostname === 'cylinder-express.com'
      || hostname === 'www.cylinder-express.com'
      || hostname === 'cylinderexpress.com'
      || hostname === 'www.cylinderexpress.com';
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
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
  social_provider: { type: String, default: null, index: true },
  social_id: { type: String, default: null, index: true },
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
  employee_position: { type: String, default: null, trim: true },
  employee_code: { type: String, default: null, trim: true, index: true, sparse: true, unique: true },
  is_active: { type: Boolean, default: true },
  permanent_address: { type: String, default: null },
  permanent_latitude: { type: Number, default: null },
  permanent_longitude: { type: Number, default: null },
  permanent_plus_code: { type: String, default: null, trim: true },
  ...common,
}, { toJSON });

const CategorySchema = new mongoose.Schema({ name: String, slug: String, icon: String, description: String, sort_order: Number, created_at: { type: Date, default: Date.now } }, { toJSON });
const ProductSchema = new mongoose.Schema({ category_id: String, name: String, description: String, price: Number, gas_price: { type: Number, default: null }, bottle_price: { type: Number, default: null }, image_url: String, type: String, company_name: String, size: String, valve_size: String, valve_connection: String, unit: { type: String, default: 'piece' }, is_bestseller: Boolean, is_available: Boolean, sort_order: Number, ...common }, { toJSON });
const AddressSchema = new mongoose.Schema({ user_id: String, label: String, address_line1: String, address_line2: String, city: String, district: String, area: String, postal_code: String, latitude: Number, longitude: Number, is_default: Boolean, ...common }, { toJSON });
const OrderSchema = new mongoose.Schema({
  user_id: String,
  address_id: String,
  delivery_man_id: { type: String, default: null, index: true },
  status: { type: String, default: 'pending' },
  total_amount: Number,
  delivery_fee: Number,
  floor_number: Number,
  floor_charge: Number,
  promo_code: String,
  discount_amount: Number,
  notes: String,
  confirmed_at: { type: Date, default: null },
  delivered_at: { type: Date, default: null },
  cancelled_at: { type: Date, default: null },
  admin_reminder_last_sent_at: { type: Date, default: null },
  delivery_assigned_at: { type: Date, default: null },
  delivery_accepted_at: { type: Date, default: null },
  delivery_accept_reminder_last_sent_at: { type: Date, default: null },
  delivery_delivered_reminder_last_sent_at: { type: Date, default: null },
  delivery_delay_notified_at: { type: Date, default: null },
  ...common
}, { toJSON });
const OrderItemSchema = new mongoose.Schema({ order_id: String, product_id: String, quantity: Number, unit_price: Number, selected_order_type: String, selected_valve_size: String, selected_valve_connection: String, created_at: { type: Date, default: Date.now } }, { toJSON });
const ServiceBookingSchema = new mongoose.Schema({ user_id: String, product_id: String, address_id: String, status: { type: String, default: 'pending' }, scheduled_date: String, scheduled_time: String, notes: String, ...common }, { toJSON });
const OfferSchema = new mongoose.Schema({ title: String, description: String, badge_text: String, discount_type: String, discount_value: Number, code: String, product_id: String, category_slug: String, max_uses_per_customer: { type: Number, default: 1 }, bg_from: String, bg_to: String, image_url: String, valid_from: { type: Date, default: Date.now }, valid_until: Date, is_active: Boolean, sort_order: Number, created_at: { type: Date, default: Date.now } }, { toJSON });
const HeroSlideSchema = new mongoose.Schema({ title: String, subtitle: String, image_url: { type: String, required: true }, sort_order: { type: Number, default: 0 }, is_active: { type: Boolean, default: true }, ...common }, { toJSON });
const UploadAssetSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  original_name: { type: String, default: null },
  bucket: { type: String, default: 'uploads', index: true },
  content_type: { type: String, default: 'application/octet-stream' },
  size: { type: Number, default: 0 },
  data: { type: Buffer, required: true },
  created_at: { type: Date, default: Date.now },
}, { toJSON });
const OtpSchema = new mongoose.Schema({ phone: String, otp: String, used: { type: Boolean, default: false }, expires_at: Date, created_at: { type: Date, default: Date.now } }, { toJSON });
const PasswordResetSchema = new mongoose.Schema({ phone: String, token: String, used: { type: Boolean, default: false }, expires_at: Date, created_at: { type: Date, default: Date.now } }, { toJSON });
const CustomerLocationSchema = new mongoose.Schema({ user_id: { type: String, unique: true }, active_order_id: { type: String, default: null, index: true }, latitude: Number, longitude: Number, accuracy: Number, is_sharing: { type: Boolean, default: false }, last_seen: { type: Date, default: Date.now }, updated_at: { type: Date, default: Date.now } }, { toJSON });
const CustomerLocationPointSchema = new mongoose.Schema({ user_id: { type: String, index: true }, order_id: { type: String, default: null, index: true }, latitude: Number, longitude: Number, accuracy: Number, recorded_at: { type: Date, default: Date.now, index: true }, created_at: { type: Date, default: Date.now } }, { toJSON });
const DeliveryLocationSchema = new mongoose.Schema({ user_id: { type: String, unique: true, index: true }, latitude: Number, longitude: Number, accuracy: Number, is_sharing: { type: Boolean, default: false }, last_seen: { type: Date, default: Date.now }, updated_at: { type: Date, default: Date.now } }, { toJSON });
const DeliveryLocationPointSchema = new mongoose.Schema({ user_id: { type: String, index: true }, order_id: { type: String, default: null, index: true }, latitude: Number, longitude: Number, accuracy: Number, recorded_at: { type: Date, default: Date.now, index: true }, created_at: { type: Date, default: Date.now } }, { toJSON });

const LpgUsageProfileSchema = new mongoose.Schema({
  user_id: { type: String, required: true, index: true },
  cylinder_size_kg: { type: Number, required: true },
  sample_count: { type: Number, default: 0 },
  average_interval_days: { type: Number, default: null },
  confidence: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  last_order_id: { type: String, default: null },
  last_order_at: { type: Date, default: null },
  predicted_empty_at: { type: Date, default: null, index: true },
  admin_adjusted_empty_at: { type: Date, default: null, index: true },
  admin_adjusted_by: { type: String, default: null },
  admin_adjusted_at: { type: Date, default: null },
  reminder_at: { type: Date, default: null, index: true },
  reminder_sent_for_order_id: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { toJSON });
LpgUsageProfileSchema.index({ user_id: 1, cylinder_size_kg: 1 }, { unique: true });

const DeliveryAdminMessageSchema = new mongoose.Schema({
  delivery_user_id: { type: String, required: true, index: true },
  sender_id: { type: String, required: true, index: true },
  sender_role: { type: String, enum: ['delivery', 'admin'], required: true },
  sender_name: { type: String, default: null, trim: true },
  sender_position: { type: String, default: null, trim: true },
  message: { type: String, required: true, maxlength: 2000 },
  read_by_admin: { type: Boolean, default: false, index: true },
  read_by_delivery: { type: Boolean, default: false, index: true },
  created_at: { type: Date, default: Date.now, index: true },
  updated_at: { type: Date, default: Date.now },
}, { toJSON });
DeliveryAdminMessageSchema.index({ delivery_user_id: 1, created_at: 1 });


const CustomerAdminMessageSchema = new mongoose.Schema({
  customer_user_id: { type: String, required: true, index: true },
  sender_id: { type: String, required: true, index: true },
  sender_role: { type: String, enum: ['customer', 'admin'], required: true },
  sender_name: { type: String, default: null, trim: true },
  sender_position: { type: String, default: null, trim: true },
  message: { type: String, required: true, maxlength: 2000 },
  read_by_admin: { type: Boolean, default: false, index: true },
  read_by_customer: { type: Boolean, default: false, index: true },
  created_at: { type: Date, default: Date.now, index: true },
  updated_at: { type: Date, default: Date.now },
}, { toJSON });
CustomerAdminMessageSchema.index({ customer_user_id: 1, created_at: 1 });

const NotificationSchema = new mongoose.Schema({
  user_id: { type: String, index: true },
  role_target: { type: String, default: null, index: true },
  order_id: { type: String, default: null, index: true },
  type: { type: String, default: 'info', index: true },
  title: String,
  message: String,
  is_read: { type: Boolean, default: false, index: true },
  urgent: { type: Boolean, default: false },
  buzz: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { toJSON });

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
  hero_slides: mongoose.model('HeroSlide', HeroSlideSchema),
  upload_assets: mongoose.model('UploadAsset', UploadAssetSchema),
  otp_verifications: mongoose.model('OtpVerification', OtpSchema),
  password_reset_sessions: mongoose.model('PasswordResetSession', PasswordResetSchema),
  customer_locations: mongoose.model('CustomerLocation', CustomerLocationSchema),
  customer_location_points: mongoose.model('CustomerLocationPoint', CustomerLocationPointSchema),
  delivery_locations: mongoose.model('DeliveryLocation', DeliveryLocationSchema),
  delivery_location_points: mongoose.model('DeliveryLocationPoint', DeliveryLocationPointSchema),
  notifications: mongoose.model('Notification', NotificationSchema),
  delivery_admin_messages: mongoose.model('DeliveryAdminMessage', DeliveryAdminMessageSchema),
  customer_admin_messages: mongoose.model('CustomerAdminMessage', CustomerAdminMessageSchema),
  lpg_usage_profiles: mongoose.model('LpgUsageProfile', LpgUsageProfileSchema),
};

function signUser(user) {
  const safe = { id: user.id, email: user.email || null, phone: user.phone || null };
  return { access_token: jwt.sign(safe, JWT_SECRET, { expiresIn: '7d' }), user: safe };
}

async function fetchSocialProfile(provider, accessToken) {
  if (!accessToken) throw new Error('Social access token is required');

  if (provider === 'google') {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.sub) throw new Error(payload.error_description || payload.error || 'Google login verification failed');
    return {
      provider: 'google',
      providerId: String(payload.sub),
      email: payload.email ? String(payload.email).toLowerCase() : null,
      name: payload.name || payload.given_name || 'Google User',
      avatar: payload.picture || null,
    };
  }

  if (provider === 'facebook') {
    const url = new URL('https://graph.facebook.com/me');
    url.searchParams.set('fields', 'id,name,email,picture.type(large)');
    url.searchParams.set('access_token', accessToken);
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.id) throw new Error(payload.error?.message || 'Facebook login verification failed');
    return {
      provider: 'facebook',
      providerId: String(payload.id),
      email: payload.email ? String(payload.email).toLowerCase() : null,
      name: payload.name || 'Facebook User',
      avatar: payload.picture?.data?.url || null,
    };
  }

  throw new Error('Unsupported social login provider');
}

async function signInOrCreateSocialUser(socialProfile) {
  const socialPhone = `${socialProfile.provider}:${socialProfile.providerId}`;
  let user = await models.users.findOne({ social_provider: socialProfile.provider, social_id: socialProfile.providerId });

  if (!user && socialProfile.email) {
    user = await models.users.findOne({ email: socialProfile.email });
    if (user) {
      user.social_provider = socialProfile.provider;
      user.social_id = socialProfile.providerId;
      await user.save();
    }
  }

  if (!user) {
    user = await models.users.create({
      email: socialProfile.email || `${socialProfile.provider}_${socialProfile.providerId}@social.cylinderexpress.local`,
      phone: socialPhone,
      password_hash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
      social_provider: socialProfile.provider,
      social_id: socialProfile.providerId,
    });
  }

  let profile = await models.profiles.findOne({ user_id: user.id });
  if (!profile) {
    const existingProfiles = await models.profiles.countDocuments();
    profile = await models.profiles.create({
      user_id: user.id,
      full_name: socialProfile.name,
      phone: socialPhone,
      email: socialProfile.email || null,
      avatar_url: socialProfile.avatar || null,
      is_admin: existingProfiles === 0,
      role: existingProfiles === 0 ? 'admin' : 'customer',
      permissions: existingProfiles === 0 ? sanitizePermissions(Object.fromEntries(ADMIN_PERMISSIONS.map((key) => [key, true]))) : {},
      is_active: true,
    });
  } else {
    let changed = false;
    if (socialProfile.avatar && !profile.avatar_url) { profile.avatar_url = socialProfile.avatar; changed = true; }
    if (socialProfile.email && !profile.email) { profile.email = socialProfile.email; changed = true; }
    if (changed) await profile.save();
  }

  if (profile?.is_active === false) {
    const error = new Error('This account is inactive. Please contact the Administration Head.');
    error.statusCode = 403;
    throw error;
  }

  return user;
}

const ADMIN_PERMISSIONS = ['dashboard', 'orders', 'products', 'offers', 'hero', 'locations', 'users', 'account_delete', 'delivery_chat', 'customer_chat', 'cylinder_usage'];

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


async function getOrderAdmins() {
  const admins = await models.profiles.find({ is_admin: true, is_active: { $ne: false } });
  return admins.filter((profile) => hasAdminPermission(profile, 'orders'));
}

async function createNotification({ user_id, role_target = null, order_id = null, type = 'info', title, message, urgent = false, buzz = false }) {
  if (!user_id && !role_target) return null;
  return models.notifications.create({
    user_id: user_id || null,
    role_target,
    order_id: order_id || null,
    type,
    title,
    message,
    urgent: Boolean(urgent),
    buzz: Boolean(buzz),
    is_read: false,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

async function silenceOrderNotifications(orderId, types = [], userId = null) {
  if (!orderId || !types.length) return;
  const query = {
    order_id: String(orderId),
    type: { $in: types },
    $or: [{ is_read: false }, { buzz: true }, { urgent: true }],
  };
  if (userId) query.user_id = String(userId);
  await models.notifications.updateMany(query, {
    $set: { is_read: true, buzz: false, urgent: false, updated_at: new Date() },
  });
}

async function notifyAdmins(payload) {
  const admins = await getOrderAdmins();
  await Promise.all(admins.map((admin) => createNotification({ ...payload, user_id: admin.user_id, role_target: 'admin' })));
}

async function notifyOrderCustomer(order, status) {
  if (!order?.user_id) return;
  const statusText = status === 'delivered' ? 'delivered' : status === 'confirmed' ? 'confirmed' : status;
  const title = status === 'delivered' ? 'Order delivered' : status === 'confirmed' ? 'Order confirmed' : 'Order updated';
  const message = status === 'delivered'
    ? `Your Cylinder Express order #${String(order.id).slice(-6)} has been delivered. Thank you.`
    : status === 'confirmed'
      ? `Your Cylinder Express order #${String(order.id).slice(-6)} has been confirmed. Delivery will start soon.`
      : `Your Cylinder Express order #${String(order.id).slice(-6)} is now ${statusText}.`;
  await createNotification({ user_id: order.user_id, order_id: order.id, type: `order_${status}`, title, message, urgent: false, buzz: false });
}

async function notifyDeliveryManAssignment(order) {
  if (!order?.delivery_man_id) return;
  await createNotification({
    user_id: order.delivery_man_id,
    order_id: order.id,
    type: 'delivery_assigned',
    title: 'New delivery assigned',
    message: `You have been assigned order #${String(order.id).slice(-6)}. Please accept the delivery within 5 minutes and start delivery.`,
    urgent: true,
    buzz: true,
  });
}


function parseCylinderSizeKg(value) {
  const match = String(value || '').toLowerCase().match(/(\d+(?:\.\d+)?)\s*kg/);
  return match ? Number(match[1]) : null;
}

function defaultUsageDaysForKg(sizeKg) {
  if (!Number.isFinite(sizeKg)) return 60;
  if (sizeKg <= 6) return 45;
  if (sizeKg <= 13) return 60;
  if (sizeKg <= 20) return 70;
  if (sizeKg <= 35) return 80;
  return 90;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function rebuildLpgUsageProfiles() {
  const lpgCategory = await models.categories.findOne({ slug: 'lpg-cylinders' });
  if (!lpgCategory) return;

  const products = await models.products.find({ category_id: String(lpgCategory.id) });
  const productMap = new Map(products.map((product) => [String(product.id), product]));
  const deliveredOrders = await models.orders
    .find({ status: 'delivered', delivered_at: { $ne: null } })
    .sort({ delivered_at: 1, created_at: 1 });
  if (!deliveredOrders.length) return;

  const orderIds = deliveredOrders.map((order) => String(order.id));
  const items = await models.order_items.find({ order_id: { $in: orderIds } });
  const itemsByOrder = new Map();
  for (const item of items) {
    const key = String(item.order_id);
    if (!itemsByOrder.has(key)) itemsByOrder.set(key, []);
    itemsByOrder.get(key).push(item);
  }

  const history = new Map();
  for (const order of deliveredOrders) {
    const date = order.delivered_at || order.confirmed_at || order.created_at;
    if (!date || !order.user_id) continue;
    const seenSizes = new Set();
    for (const item of itemsByOrder.get(String(order.id)) || []) {
      const product = productMap.get(String(item.product_id));
      if (!product) continue;
      const sizeKg = parseCylinderSizeKg(product.size || product.name);
      if (!sizeKg || seenSizes.has(sizeKg)) continue;
      seenSizes.add(sizeKg);
      const key = `${order.user_id}:${sizeKg}`;
      if (!history.has(key)) history.set(key, []);
      history.get(key).push({ orderId: String(order.id), date: new Date(date) });
    }
  }

  for (const [key, events] of history.entries()) {
    const splitAt = key.lastIndexOf(':');
    const userId = key.slice(0, splitAt);
    const sizeKg = Number(key.slice(splitAt + 1));
    const recent = events.slice(-6);
    const intervals = [];
    for (let i = 1; i < recent.length; i += 1) {
      const days = (recent[i].date.getTime() - recent[i - 1].date.getTime()) / 86400000;
      if (days >= 7 && days <= 240) intervals.push(days);
    }

    const learned = median(intervals);
    const estimatedDays = Math.round(Math.max(14, Math.min(180, learned || defaultUsageDaysForKg(sizeKg))));
    const last = recent[recent.length - 1];
    const predictedEmptyAt = new Date(last.date.getTime() + estimatedDays * 86400000);
    const reminderLeadDays = estimatedDays <= 30 ? 3 : 7;
    const reminderAt = new Date(predictedEmptyAt.getTime() - reminderLeadDays * 86400000);
    const confidence = intervals.length >= 2 ? 'high' : intervals.length === 1 ? 'medium' : 'low';

    const existing = await models.lpg_usage_profiles.findOne({ user_id: userId, cylinder_size_kg: sizeKg });
    const lastChanged = !existing || String(existing.last_order_id || '') !== last.orderId;
    await models.lpg_usage_profiles.findOneAndUpdate(
      { user_id: userId, cylinder_size_kg: sizeKg },
      {
        $set: {
          sample_count: recent.length,
          average_interval_days: estimatedDays,
          confidence,
          last_order_id: last.orderId,
          last_order_at: last.date,
          predicted_empty_at: predictedEmptyAt,
          reminder_at: reminderAt,
          ...(lastChanged ? { reminder_sent_for_order_id: null } : {}),
          updated_at: new Date(),
        },
        $setOnInsert: { created_at: new Date() },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

async function runLpgEmptyReminderChecks() {
  await rebuildLpgUsageProfiles();
  const now = new Date();
  const dueProfiles = await models.lpg_usage_profiles.find({
    reminder_at: { $lte: now },
    predicted_empty_at: { $gte: new Date(now.getTime() - 14 * 86400000) },
    $expr: { $ne: ['$reminder_sent_for_order_id', '$last_order_id'] },
  }).limit(100);

  for (const profile of dueProfiles) {
    const daysLeft = Math.max(0, Math.ceil((profile.predicted_empty_at.getTime() - now.getTime()) / 86400000));
    const confidenceText = profile.confidence === 'high' ? 'based on your recent ordering pattern' : 'based on an estimated usage period';
    await createNotification({
      user_id: profile.user_id,
      order_id: null,
      type: 'lpg_refill_prediction',
      title: 'Your LPG cylinder may be nearly empty',
      message: `Your ${profile.cylinder_size_kg}kg LPG cylinder may run out ${daysLeft > 0 ? `in about ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'soon'}, ${confidenceText}. Please order a refill before it becomes empty.`,
      urgent: false,
      buzz: true,
    });
    profile.reminder_sent_for_order_id = profile.last_order_id;
    profile.updated_at = now;
    await profile.save();
  }
}

async function runOrderAlertChecks() {
  const now = new Date();
  const fourMinutesAgo = new Date(now.getTime() - 4 * 60 * 1000);
  const oneMinuteAgo = new Date(now.getTime() - 1 * 60 * 1000);
  const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);
  const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);

  const overduePending = await models.orders.find({
    status: 'pending',
    created_at: { $lte: fourMinutesAgo },
    $or: [
      { admin_reminder_last_sent_at: null },
      { admin_reminder_last_sent_at: { $exists: false } },
      { admin_reminder_last_sent_at: { $lte: oneMinuteAgo } },
    ],
  }).limit(50);

  for (const order of overduePending) {
    await notifyAdmins({
      order_id: order.id,
      type: 'admin_order_confirm_overdue',
      title: 'Order confirmation overdue',
      message: `Order #${String(order.id).slice(-6)} has not been confirmed within 4 minutes. Please confirm or cancel it now.`,
      urgent: true,
      buzz: true,
    });
    order.admin_reminder_last_sent_at = now;
    await order.save();
  }

  const deliveryAcceptOverdue = await models.orders.find({
    status: { $in: ['pending', 'confirmed'] },
    delivery_man_id: { $nin: [null, ''] },
    $or: [{ delivery_accepted_at: null }, { delivery_accepted_at: { $exists: false } }],
    // Start accept reminders immediately after assignment, then repeat every 30 seconds until accepted.
    delivery_assigned_at: { $lte: now },
    $and: [{
      $or: [
        { delivery_accept_reminder_last_sent_at: null },
        { delivery_accept_reminder_last_sent_at: { $exists: false } },
        { delivery_accept_reminder_last_sent_at: { $lte: thirtySecondsAgo } },
      ],
    }],
  }).limit(50);

  for (const order of deliveryAcceptOverdue) {
    await createNotification({
      user_id: order.delivery_man_id,
      order_id: order.id,
      type: 'delivery_accept_overdue',
      title: 'Accept delivery now',
      message: `Order #${String(order.id).slice(-6)} is assigned to you. Accept this delivery now. Alarm will repeat every 30 seconds until you accept.`,
      urgent: true,
      buzz: true,
    });
    order.delivery_accept_reminder_last_sent_at = now;
    await order.save();
  }

  const deliveryNotCompleted = await models.orders.find({
    status: { $in: ['confirmed', 'processing'] },
    delivery_man_id: { $nin: [null, ''] },
    $or: [
      { delivery_accepted_at: { $lte: twentyMinutesAgo } },
      {
        delivery_accepted_at: { $in: [null, undefined] },
        delivery_assigned_at: { $lte: twentyMinutesAgo },
      },
    ],
    $and: [{
      $or: [
        { delivery_delivered_reminder_last_sent_at: null },
        { delivery_delivered_reminder_last_sent_at: { $exists: false } },
        { delivery_delivered_reminder_last_sent_at: { $lte: thirtySecondsAgo } },
      ],
    }],
  }).limit(50);

  for (const order of deliveryNotCompleted) {
    await notifyAdmins({
      order_id: order.id,
      type: 'delivery_not_delivered_20m_admin',
      title: 'Delivery not completed',
      message: `Order #${String(order.id).slice(-6)} has not been marked delivered within 20 minutes. Check the driver and assign another nearby HUB man if needed.`,
      urgent: true,
      buzz: true,
    });
    order.delivery_delivered_reminder_last_sent_at = now;
    await order.save();
  }
}

async function sendBulkSmsBdMessage(phone, message) {
  if (!SMS_ENABLED) return { sent: false, skipped: true };

  const smsNumber = normalizePhoneForSms(phone);
  if (!/^8801\d{9}$/.test(smsNumber)) {
    throw new Error(`Invalid Bangladesh phone number for SMS: ${phone}`);
  }

  const params = new URLSearchParams({
    api_key: BULKSMSBD_API_KEY,
    type: 'text',
    senderid: BULKSMSBD_SENDER_ID,
    number: smsNumber,
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

  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  const responseCode = parsed?.response_code ?? parsed?.responseCode ?? parsed?.status_code ?? parsed?.status;
  const successCodes = new Set([202, '202', 200, '200', 'success', 'SUCCESS', true]);
  if (responseCode !== undefined && !successCodes.has(responseCode)) {
    throw new Error(`BulkSMSBD rejected SMS: ${text}`);
  }

  return { sent: true, skipped: false, number: smsNumber, provider_response: text };
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

const routeContext = {
  app, models, mongoose, bcrypt, jwt, crypto, multer, path, rootDir,
  JWT_SECRET, SMS_ENABLED, BULKSMSBD_API_URL, BULKSMSBD_API_KEY,
  BULKSMSBD_SENDER_ID, CHATBOT_API_KEY, CHATBOT_API_URL, CHATBOT_MODEL,
  CHATBOT_ENABLED, GOOGLE_GEOCODING_API_KEY, geocodeDeliveryBase, signUser,
  fetchSocialProfile, signInOrCreateSocialUser, sanitizePermissions,
  hasAdminPermission, ADMIN_PERMISSIONS, getOrderAdmins, createNotification,
  silenceOrderNotifications, notifyAdmins, notifyOrderCustomer,
  notifyDeliveryManAssignment, parseCylinderSizeKg, defaultUsageDaysForKg,
  median, rebuildLpgUsageProfiles, runLpgEmptyReminderChecks,
  runOrderAlertChecks, sendBulkSmsBdMessage, requireAuth,
  requireAdminPermission, requireAdminUserManagement, normalizeMongoField,
  buildMongoQuery, getOptionalAuthUserId, ensureUserOwnedPayload, decorate,
};

registerChatRoutes(routeContext);
registerNotificationRoutes(routeContext);
registerAuthRoutes(routeContext);
registerTableRoutes(routeContext);
registerOtpRoutes(routeContext);
registerUploadRoutes(routeContext);

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

  // Products are intentionally NOT seeded during application startup.
  // Admin-created/deleted catalog data must remain authoritative across deploys.
  // This prevents deleted LPG cylinders and other default products from being
  // recreated whenever Render or a manual deployment restarts the backend.

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

export async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    await ensureDefaultCatalog();
    await backfillProfileRolesAndPermissions();
    await backfillOrderUserIds();
    await runOrderAlertChecks().catch((error) => console.error('Initial order alert check failed:', error.message));
    await runLpgEmptyReminderChecks().catch((error) => console.error('Initial LPG usage prediction failed:', error.message));
    setInterval(() => {
      runOrderAlertChecks().catch((error) => console.error('Order alert check failed:', error.message));
    }, 30 * 1000);
    setInterval(() => {
      runLpgEmptyReminderChecks().catch((error) => console.error('LPG usage prediction failed:', error.message));
    }, 6 * 60 * 60 * 1000);
    app.listen(PORT, () => console.log(`Cylinder Express MongoDB API running on http://localhost:${PORT}`));
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

export { app };
