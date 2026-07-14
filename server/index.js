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

app.get('/api/admin/sms-status', requireAuth, requireAdminUserManagement, (_req, res) => {
  res.json({
    data: {
      enabled: SMS_ENABLED,
      api_url: BULKSMSBD_API_URL,
      has_api_key: Boolean(BULKSMSBD_API_KEY),
      has_sender_id: Boolean(BULKSMSBD_SENDER_ID),
      sender_id: BULKSMSBD_SENDER_ID || null,
    },
    error: null,
  });
});



async function getAuthenticatedProfile(req) {
  return models.profiles.findOne({ user_id: req.auth.id });
}



function chatbotEmergencyReply(message, language = 'en') {
  const q = String(message || '').toLowerCase();
  const leak = /gas.{0,12}(leak|smell|odor|gondho)|(?:leak|smell|odor|gondho).{0,12}gas|গ্যাস.{0,12}(লিক|গন্ধ)|(?:লিক|গন্ধ).{0,12}গ্যাস/.test(q);
  if (!leak) return null;
  return language === 'bn'
    ? '⚠️ গ্যাস লিক বা গ্যাসের গন্ধ পেলে এখনই আগুন, ম্যাচ, লাইটার ও সিগারেট বন্ধ করুন। কোনো বৈদ্যুতিক সুইচ, ফ্যান, চার্জার বা যন্ত্র চালু/বন্ধ করবেন না। নিরাপদ হলে চুলার নব ও রেগুলেটর বন্ধ করুন, দরজা-জানালা হাতে খুলুন, সবাইকে বাইরে নিয়ে যান এবং বাইরে থেকে 999 বা Cylinder Express কাস্টমার কেয়ারে কল করুন। নিজে মেরামত করবেন না এবং প্রশিক্ষিত টেকনিশিয়ান পরীক্ষা না করা পর্যন্ত আবার ব্যবহার করবেন না।'
    : '⚠️ If you smell gas or suspect an LPG leak, extinguish flames, matches, lighters, and cigarettes immediately. Do not operate electrical switches, fans, chargers, or appliances. If safe, close the stove knobs and regulator, open doors and windows manually, move everyone outside, and call 999 or Cylinder Express support from outdoors. Do not repair or reuse the system until a trained technician has inspected it.';
}

function normalizeChatText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9\u0980-\u09ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function localChatbotReply(message, language = 'en') {
  const q = normalizeChatText(message);
  const bn = language === 'bn' || /[\u0980-\u09ff]/.test(q);
  const has = (...terms) => terms.some((term) => q.includes(term));

  if (has('price', 'cost', 'dam', 'দাম', 'মূল্য')) {
    return bn
      ? 'বর্তমান দাম দেখতে Products পেজে নির্দিষ্ট সিলিন্ডার বা পণ্যটি খুলুন। রিফিলে শুধু গ্যাসের দাম এবং নতুন সিলিন্ডারে গ্যাসের দাম + বোতলের দাম যোগ হয়। নির্দিষ্ট ব্র্যান্ড ও কেজি লিখলে আমি আরও নির্দিষ্টভাবে সাহায্য করব।'
      : 'Open the specific cylinder or item on the Products page for its current price. Refill charges only the gas price; a new cylinder charges gas price plus bottle price. Tell me the brand and cylinder size for more specific guidance.';
  }
  if (has('family', 'member', 'people', 'person', 'পরিবার', 'জন', 'সদস্য', 'বার রান্না', 'times cook', 'meal')) {
    return bn
      ? 'সঠিক সাইজ বাছাই করতে পরিবারের সদস্য সংখ্যা, দিনে কতবার রান্না করেন এবং প্রতি বেলায় আনুমানিক কয়টি পদ রান্না হয় লিখুন। সাধারণভাবে হালকা ব্যবহারে ৫–৬ কেজি, অধিকাংশ পরিবারের জন্য ১২–১২.৫ কেজি, এবং বেশি/দীর্ঘ রান্নায় ২২ কেজি বা বড় সাইজ প্রয়োজন হতে পারে। এটি আনুমানিক—চুলার দক্ষতা ও রান্নার ধরনেও ব্যবহার বদলায়।'
      : 'For a useful size estimate, tell me the number of family members, cooking sessions per day, and approximate dishes per session. As a rough guide: 5–6 kg suits light use, 12–12.5 kg suits many households, and 22 kg or larger may suit heavier or longer cooking. Actual usage varies by burner efficiency and cooking style.';
  }
  if (has('save gas', 'less gas', 'gas kom', 'সাশ্রয়', 'কম খরচ', 'গ্যাস বাঁচ')) {
    return bn
      ? 'গ্যাস সাশ্রয়ে ঢাকনা দিয়ে রান্না করুন, প্রয়োজনমতো শিখা কমান, বার্নারের ছিদ্র পরিষ্কার রাখুন, উপকরণ আগে প্রস্তুত করুন, উপযুক্ত আকারের হাঁড়ি ব্যবহার করুন এবং অপ্রয়োজনে চুলা জ্বালিয়ে রাখবেন না। হলুদ শিখা বা অস্বাভাবিক গন্ধ হলে ব্যবহার বন্ধ করে টেকনিশিয়ান দেখান।'
      : 'To save gas, cook with lids, lower the flame after boiling starts, keep burner ports clean, prepare ingredients before lighting the stove, use correctly sized cookware, and never leave the burner on unnecessarily. Stop use and arrange inspection if the flame is yellow or there is an unusual smell.';
  }
  if (has('fast finish', 'finished fast', 'quickly empty', 'taratari sesh', 'দ্রুত শেষ', 'তাড়াতাড়ি শেষ')) {
    return bn
      ? 'সিলিন্ডার দ্রুত শেষ হওয়ার কারণ হতে পারে বেশি রান্না, বড় শিখা, বার্নার/রেগুলেটরের সমস্যা, পাইপ বা সংযোগে লিক, অথবা আগের তুলনায় বেশি ব্যবহার। আগুন দিয়ে কখনো লিক পরীক্ষা করবেন না; সাবান-পানির বুদবুদ পরীক্ষাও প্রশিক্ষিত টেকনিশিয়ান দিয়ে করানো নিরাপদ। সন্দেহ হলে ব্যবহার বন্ধ করে সার্ভিস বুক করুন।'
      : 'A cylinder may finish quickly because of heavier cooking, unnecessarily high flame, burner/regulator problems, a hose or connection leak, or increased household use. Never test leaks with fire. Stop using the system and book a technician inspection if usage changed suddenly or a leak is suspected.';
  }
  if (has('yellow flame', 'orange flame', 'black pot', 'soot', 'holud agun', 'হলুদ আগুন', 'হাঁড়ি কালো', 'কালো হয়')) {
    return bn
      ? 'হলুদ/কমলা শিখা বা হাঁড়ি কালো হওয়া সাধারণত অসম্পূর্ণ দহন, নোংরা বার্নার বা বাতাসের অনুপাতের সমস্যার লক্ষণ। চুলা বন্ধ করুন, ঠান্ডা হলে বার্নার পরিষ্কার করুন; সমস্যা থাকলে নিজে খুলে মেরামত না করে টেকনিশিয়ান ডাকুন।'
      : 'A yellow/orange flame or black soot usually indicates incomplete combustion, blocked burner ports, or an air-mix problem. Turn the stove off, clean the burner only after it is cool, and arrange a technician inspection if the problem continues.';
  }
  if (has('regulator', 'pipe', 'hose', 'valve', 'burner', 'stove', 'রেগুলেটর', 'পাইপ', 'ভালভ', 'বার্নার', 'চুলা')) {
    return bn
      ? 'রেগুলেটর, পাইপ, ভালভ, বার্নার বা চুলার সমস্যা হলে গ্যাস সরবরাহ বন্ধ করুন এবং নিজে পরিবর্তন বা মেরামত করবেন না। Products পেজে উপযুক্ত পণ্য দেখতে পারেন, অথবা Services পেজ থেকে ইনস্টলেশন/পরিদর্শন বুক করুন। সমস্যা ও পণ্যের নাম লিখলে আমি ধাপে ধাপে নিরাপদ নির্দেশনা দেব।'
      : 'For regulator, hose, valve, burner, or stove problems, shut off the gas supply and do not modify or repair the equipment yourself. Check compatible items on Products or book installation/inspection from Services. Describe the exact symptom and product for safer step-by-step guidance.';
  }
  if (has('order', 'delivery', 'track', 'কর্ডার', 'অর্ডার', 'ডেলিভারি', 'ট্র্যাক')) {
    return bn
      ? 'Profile Settings → My Orders থেকে অর্ডারের অবস্থা ও ডেলিভারি ট্র্যাকিং দেখুন। ব্যক্তিগত অর্ডারের তথ্য নিরাপত্তার কারণে চ্যাটবট সরাসরি দেখায় না। অর্ডার নম্বরসহ Customer Care-এ লিখলে Administration Head বা অনুমোদিত কর্মী উত্তর দিতে পারবেন।'
      : 'Open Profile Settings → My Orders to see order status and delivery tracking. For privacy, the chatbot does not expose personal order details directly. Send the order number in this chat so Customer Care staff can review it.';
  }
  if (has('address', 'location', 'ঠিকানা', 'লোকেশন')) {
    return bn
      ? 'Profile Settings → Delivery Addresses থেকে ঠিকানা যোগ বা পরিবর্তন করুন। ডিভাইস লোকেশন দিলে অ্যাপ স্থানটির নাম দেখাবে এবং অক্ষাংশ/দ্রাঘিমাংশ শুধু ডেলিভারি হিসাবের জন্য ভিতরে সংরক্ষিত থাকবে।'
      : 'Use Profile Settings → Delivery Addresses to add or edit an address. When device location is shared, the app displays the place name while coordinates remain internal for delivery calculations.';
  }
  if (has('password', 'otp', 'login', 'forgot', 'পাসওয়ার্ড', 'ওটিপি', 'লগইন')) {
    return bn
      ? 'Login পেজের Forgot Password অপশন ব্যবহার করুন। নিবন্ধিত ফোন নম্বরে OTP না এলে নম্বরটি 01XXXXXXXXX ফরম্যাটে দিন, নেটওয়ার্ক পরীক্ষা করুন এবং কিছুক্ষণ পর আবার চেষ্টা করুন। তবুও না এলে Customer Care-এ ফোন নম্বরের শেষ ৪ সংখ্যা লিখুন—সম্পূর্ণ পাসওয়ার্ড বা OTP কখনো পাঠাবেন না।'
      : 'Use Forgot Password on the Login page. If the OTP does not arrive, enter the registered number in 01XXXXXXXXX format, check network coverage, and retry shortly. If it still fails, send only the last four phone digits to Customer Care—never share a password or OTP.';
  }
  if (has('hello', 'hi', 'hey', 'salam', 'হ্যালো', 'হাই', 'আসসালাম')) {
    return bn
      ? 'স্বাগতম! LPG সিলিন্ডার, রান্না, সাইজ নির্বাচন, গ্যাস সাশ্রয়, পণ্য, অর্ডার, ডেলিভারি বা সার্ভিস—যে বিষয়ে সাহায্য চান স্বাভাবিকভাবে লিখুন।'
      : 'Welcome! Ask naturally about LPG cylinders, cooking, size selection, gas saving, products, orders, delivery, or services.';
  }

  return bn
    ? 'আপনার প্রশ্নটি পেয়েছি। এই বিষয়ে নিশ্চিত স্বয়ংক্রিয় উত্তর না থাকায় আমি ভুল তথ্য দিতে চাই না। সমস্যাটি একটু বিস্তারিত লিখুন—কোন পণ্য/সিলিন্ডার, কী লক্ষণ, কখন থেকে, এবং আপনি কী জানতে চান। আপনার বার্তাটি Customer Care-ও দেখতে পাবে এবং প্রয়োজন হলে উত্তর দেবে। জরুরি গ্যাসের গন্ধ বা লিক হলে বৈদ্যুতিক সুইচ ব্যবহার না করে সবাইকে বাইরে নিয়ে 999 বা 01967517077 / 01409472939 নম্বরে বাইরে থেকে কল করুন।'
    : 'I received your question. I do not have a reliable automatic answer for that exact issue, so I will not guess. Please add the product/cylinder involved, the exact symptom, when it started, and what you need to know. Customer Care staff can also see this message and reply. For a gas smell or suspected leak, do not operate electrical switches; move everyone outside and call 999 or 01967517077 / 01409472939 from outdoors.';
}

app.post('/api/customer-chatbot/respond', requireAuth, async (req, res) => {
  try {
    const profile = await getAuthenticatedProfile(req);
    if (!profile || profile.role === 'delivery' || profile.is_admin) {
      return res.status(403).json({ error: 'Customer access required.' });
    }
    const message = String(req.body.message || '').trim();
    const language = req.body.language === 'bn' ? 'bn' : 'en';
    if (!message) return res.status(400).json({ error: 'Message cannot be empty.' });
    if (message.length > 2000) return res.status(400).json({ error: 'Message is too long.' });

    const emergency = chatbotEmergencyReply(message, language);
    if (emergency) return res.json({ data: { reply: emergency, source: 'safety' }, error: null });
    if (!CHATBOT_ENABLED) {
      return res.json({ data: { reply: localChatbotReply(message, language), source: 'local' }, error: null });
    }

    const history = Array.isArray(req.body.history) ? req.body.history.slice(-10) : [];
    const products = await models.products.find({ is_available: { $ne: false } })
      .select('name type company_name size price gas_price bottle_price description')
      .sort({ sort_order: 1 }).limit(40).lean();
    const catalog = products.map((item) => {
      const parts = [item.name, item.company_name, item.size, item.type].filter(Boolean).join(' | ');
      const gas = item.gas_price ?? item.price;
      const bottle = item.bottle_price;
      const priceText = bottle != null ? `gas/refill ${gas} BDT, bottle ${bottle} BDT, new total ${Number(gas || 0) + Number(bottle || 0)} BDT` : `price ${item.price} BDT`;
      return `- ${parts}: ${priceText}${item.description ? `; ${String(item.description).slice(0, 120)}` : ''}`;
    }).join('\n');

    const system = `You are the Cylinder Express customer-care chatbot for an LPG ordering and service web app in Bangladesh. Reply in ${language === 'bn' ? 'natural Bangla' : 'clear English'}, matching the customer's wording when they mix Bangla and English. Understand spelling mistakes, Banglish, incomplete questions, and different sentence structures.

You may answer broadly about LPG cylinders, refill vs new cylinder, cylinder-size selection, cooking habits, gas saving, stove/burner/regulator/hose/valve issues, safe installation, products, prices from the supplied catalog, ordering, cart, addresses, delivery tracking, services, account/login, and Cylinder Express usage. Ask one concise follow-up only when essential information is missing. Never invent stock, price, delivery time, order status, or company policy. For personal order/account status, tell the customer to open the relevant app page or contact Customer Care.

Safety rules: For suspected gas leaks, fire, dizziness, breathing difficulty, or poisoning, prioritize immediate emergency safety. Never advise testing a leak with fire, opening electrical switches, repairing a cylinder, transferring gas, heating a cylinder, or bypassing a regulator. Say estimates are approximate when recommending cylinder size or duration.

Useful app facts:
- Refill price is gas price only. New cylinder price is gas price plus bottle price.
- Customers choose New Cylinder or Refill on the LPG product-detail page.
- Orders are available from Profile Settings > My Orders.
- Addresses are available from Profile Settings > Delivery Addresses.
- Cylinder Usage shows estimated finish date and remaining days.
- Direct support numbers: 01967517077 and 01409472939.

Current product catalog:
${catalog || '- Catalog unavailable; do not invent current prices.'}

Keep replies useful and concise, normally under 180 words. Do not claim to be a human.`;

    const messages = [
      { role: 'system', content: system },
      ...history.filter((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
        .map((item) => ({ role: item.role, content: item.content.slice(0, 2000) })),
      { role: 'user', content: message },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(CHATBOT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CHATBOT_API_KEY}` },
        body: JSON.stringify({ model: CHATBOT_MODEL, messages, temperature: 0.25, max_tokens: 450 }),
        signal: controller.signal,
      });
    } finally { clearTimeout(timeout); }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('Chatbot provider error:', response.status, detail.slice(0, 500));
      return res.json({ data: { reply: localChatbotReply(message, language), source: 'local' }, error: null });
    }
    const payload = await response.json();
    const reply = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!reply) return res.json({ data: { reply: localChatbotReply(message, language), source: 'local' }, error: null });
    return res.json({ data: { reply, source: 'ai' }, error: null });
  } catch (error) {
    const language = req.body?.language === 'bn' ? 'bn' : 'en';
    const message = String(req.body?.message || '').trim();
    console.error('Chatbot response fallback:', error?.message || error);
    return res.json({ data: { reply: localChatbotReply(message, language), source: 'local' }, error: null });
  }
});

app.get('/api/customer-chat/conversations', requireAuth, async (req, res) => {
  try {
    const profile = await getAuthenticatedProfile(req);
    if (!profile?.is_admin) return res.status(403).json({ error: 'Administration Head or authorized employee access required.' });
    const customerIds = await models.customer_admin_messages.distinct('customer_user_id');
    const rows = await Promise.all(customerIds.map(async (customerId) => {
      const [customer, latest, unread] = await Promise.all([
        models.profiles.findOne({ user_id: customerId }).lean(),
        models.customer_admin_messages.findOne({ customer_user_id: customerId }).sort({ created_at: -1 }).lean(),
        models.customer_admin_messages.countDocuments({ customer_user_id: customerId, sender_role: 'customer', read_by_admin: false }),
      ]);
      return {
        customer_user_id: String(customerId),
        full_name: customer?.full_name || 'Customer',
        phone: customer?.phone || '',
        avatar_url: customer?.avatar_url || null,
        last_message: latest?.message || '',
        last_message_at: latest?.created_at || customer?.created_at,
        unread_count: unread,
      };
    }));
    rows.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
    res.set('Cache-Control', 'no-store');
    res.json({ data: rows, error: null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/customer-chat/messages', requireAuth, async (req, res) => {
  try {
    const profile = await getAuthenticatedProfile(req);
    let customerUserId;
    if (profile?.is_admin) customerUserId = String(req.query.customer_user_id || '');
    else if (profile?.role !== 'delivery') customerUserId = req.auth.id;
    else return res.status(403).json({ error: 'Customer or admin access required.' });
    if (!customerUserId) return res.status(400).json({ error: 'Customer is required.' });
    const messages = await models.customer_admin_messages.find({ customer_user_id: customerUserId }).sort({ created_at: 1 }).limit(300).lean();
    res.set('Cache-Control', 'no-store');
    res.json({ data: messages.map(m => ({ ...m, id: String(m._id) })), error: null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/customer-chat/messages', requireAuth, async (req, res) => {
  try {
    const profile = await getAuthenticatedProfile(req);
    const text = String(req.body.message || '').trim();
    if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });
    if (text.length > 2000) return res.status(400).json({ error: 'Message is too long.' });
    let customerUserId; let senderRole;
    if (profile?.is_admin) { customerUserId = String(req.body.customer_user_id || ''); senderRole = 'admin'; }
    else if (profile?.role !== 'delivery') { customerUserId = req.auth.id; senderRole = 'customer'; }
    else return res.status(403).json({ error: 'Customer or admin access required.' });
    if (!customerUserId) return res.status(400).json({ error: 'Customer is required.' });
    const customer = await models.profiles.findOne({ user_id: customerUserId, role: { $ne: 'delivery' }, is_admin: { $ne: true } });
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });
    const senderName = senderRole === 'admin'
      ? (profile?.full_name || (profile?.role === 'sub_admin' ? 'Employee' : 'Administration Head'))
      : (profile?.full_name || 'Customer');
    const senderPosition = senderRole === 'admin'
      ? (profile?.employee_position || (profile?.role === 'sub_admin' ? 'Employee' : 'Administration Head'))
      : null;
    const doc = await models.customer_admin_messages.create({
      customer_user_id: customerUserId, sender_id: req.auth.id, sender_role: senderRole,
      sender_name: senderName, sender_position: senderPosition, message: text,
      read_by_admin: senderRole === 'admin', read_by_customer: senderRole === 'customer',
    });
    res.status(201).json({ data: { ...doc.toJSON(), id: String(doc._id) }, error: null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/customer-chat/read', requireAuth, async (req, res) => {
  try {
    const profile = await getAuthenticatedProfile(req);
    let customerUserId; let update;
    if (profile?.is_admin) { customerUserId = String(req.body.customer_user_id || ''); update = { read_by_admin: true, updated_at: new Date() }; }
    else if (profile?.role !== 'delivery') { customerUserId = req.auth.id; update = { read_by_customer: true, updated_at: new Date() }; }
    else return res.status(403).json({ error: 'Customer or admin access required.' });
    if (!customerUserId) return res.status(400).json({ error: 'Customer is required.' });
    await models.customer_admin_messages.updateMany({ customer_user_id: customerUserId }, { $set: update });
    res.json({ success: true, error: null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/delivery-chat/conversations', requireAuth, async (req, res) => {
  try {
    const profile = await getAuthenticatedProfile(req);
    if (!profile?.is_admin) return res.status(403).json({ error: 'Administration Head or authorized employee access required.' });
    const deliveryProfiles = await models.profiles.find({ role: 'delivery', is_active: { $ne: false } }).lean();
    const rows = await Promise.all(deliveryProfiles.map(async (delivery) => {
      const deliveryId = String(delivery.user_id);
      const [latest, unread] = await Promise.all([
        models.delivery_admin_messages.findOne({ delivery_user_id: deliveryId }).sort({ created_at: -1 }).lean(),
        models.delivery_admin_messages.countDocuments({ delivery_user_id: deliveryId, sender_role: 'delivery', read_by_admin: false }),
      ]);
      return {
        delivery_user_id: deliveryId,
        full_name: delivery.full_name || 'HUB Man',
        phone: delivery.phone || '',
        avatar_url: delivery.avatar_url || null,
        last_message: latest?.message || '',
        last_message_at: latest?.created_at || delivery.created_at,
        unread_count: unread,
      };
    }));
    rows.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
    res.set('Cache-Control', 'no-store');
    res.json({ data: rows, error: null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/delivery-chat/messages', requireAuth, async (req, res) => {
  try {
    const profile = await getAuthenticatedProfile(req);
    let deliveryUserId;
    if (profile?.role === 'delivery') deliveryUserId = req.auth.id;
    else if (profile?.is_admin) deliveryUserId = String(req.query.delivery_user_id || '');
    else return res.status(403).json({ error: 'Delivery or admin access required.' });
    if (!deliveryUserId) return res.status(400).json({ error: 'HUB Man is required.' });
    const messages = await models.delivery_admin_messages.find({ delivery_user_id: deliveryUserId }).sort({ created_at: 1 }).limit(300).lean();
    res.set('Cache-Control', 'no-store');
    res.json({ data: messages.map(m => ({ ...m, id: String(m._id) })), error: null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/delivery-chat/messages', requireAuth, async (req, res) => {
  try {
    const profile = await getAuthenticatedProfile(req);
    const text = String(req.body.message || '').trim();
    if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });
    if (text.length > 2000) return res.status(400).json({ error: 'Message is too long.' });
    let deliveryUserId;
    let senderRole;
    if (profile?.role === 'delivery') { deliveryUserId = req.auth.id; senderRole = 'delivery'; }
    else if (profile?.is_admin) { deliveryUserId = String(req.body.delivery_user_id || ''); senderRole = 'admin'; }
    else return res.status(403).json({ error: 'Delivery or admin access required.' });
    if (!deliveryUserId) return res.status(400).json({ error: 'HUB Man is required.' });
    const delivery = await models.profiles.findOne({ user_id: deliveryUserId, role: 'delivery' });
    if (!delivery) return res.status(404).json({ error: 'HUB Man not found.' });
    const senderName = senderRole === 'admin'
      ? (profile?.full_name || (profile?.role === 'sub_admin' ? 'Employee' : 'Administration Head'))
      : (profile?.full_name || 'HUB Man');
    const senderPosition = senderRole === 'admin'
      ? (profile?.employee_position || (profile?.role === 'sub_admin' ? 'Employee' : 'Administration Head'))
      : null;
    const doc = await models.delivery_admin_messages.create({
      delivery_user_id: deliveryUserId,
      sender_id: req.auth.id,
      sender_role: senderRole,
      sender_name: senderName,
      sender_position: senderPosition,
      message: text,
      read_by_admin: senderRole === 'admin',
      read_by_delivery: senderRole === 'delivery',
    });
    res.status(201).json({ data: doc.toJSON(), error: null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/delivery-chat/read', requireAuth, async (req, res) => {
  try {
    const profile = await getAuthenticatedProfile(req);
    let deliveryUserId;
    let update;
    if (profile?.role === 'delivery') {
      deliveryUserId = req.auth.id;
      update = { read_by_delivery: true, updated_at: new Date() };
    } else if (profile?.is_admin) {
      deliveryUserId = String(req.body.delivery_user_id || '');
      update = { read_by_admin: true, updated_at: new Date() };
    } else return res.status(403).json({ error: 'Delivery or admin access required.' });
    if (!deliveryUserId) return res.status(400).json({ error: 'HUB Man is required.' });
    await models.delivery_admin_messages.updateMany({ delivery_user_id: deliveryUserId }, { $set: update });
    res.json({ success: true, error: null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const [notifications, unread_count] = await Promise.all([
      models.notifications
        .find({ user_id: req.auth.id })
        .sort({ created_at: -1 })
        .limit(50)
        .lean(),
      models.notifications.countDocuments({ user_id: req.auth.id, is_read: false }),
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({ data: notifications.map((notification) => ({ ...notification, id: String(notification._id) })), unread_count, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: error.message });
  }
});



app.get('/api/admin/lpg-usage', requireAuth, async (req, res) => {
  try {
    const admin = await getAuthenticatedProfile(req);
    if (!admin?.is_admin) return res.status(403).json({ error: 'Administration Head or authorized employee access required.' });
    await rebuildLpgUsageProfiles();
    const now = new Date();
    const profiles = await models.lpg_usage_profiles.find({ predicted_empty_at: { $ne: null } }).sort({ predicted_empty_at: 1 }).lean();
    const data = await Promise.all(profiles.map(async (usage) => {
      const customer = await models.profiles.findOne({ user_id: usage.user_id }).lean();
      const effectiveEmptyAt = usage.admin_adjusted_empty_at || usage.predicted_empty_at;
      const daysRemaining = Math.ceil((new Date(effectiveEmptyAt).getTime() - now.getTime()) / 86400000);
      return { ...usage, predicted_empty_at: effectiveEmptyAt, system_predicted_empty_at: usage.predicted_empty_at, id: String(usage._id), customer_name: customer?.full_name || 'Customer', customer_phone: customer?.phone || '', days_remaining: daysRemaining, is_admin_adjusted: Boolean(usage.admin_adjusted_empty_at) };
    }));
    res.set('Cache-Control', 'no-store');
    res.json({ data, error: null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.patch('/api/admin/lpg-usage/:id', requireAuth, async (req, res) => {
  try {
    const admin = await getAuthenticatedProfile(req);
    if (!admin?.is_admin) return res.status(403).json({ error: 'Administration Head or authorized employee access required.' });
    const usage = await models.lpg_usage_profiles.findById(String(req.params.id || ''));
    if (!usage) return res.status(404).json({ error: 'Cylinder usage estimate not found.' });
    const rawDate = String(req.body.predicted_empty_at || '').trim();
    const rawDays = req.body.remaining_days;
    let adjusted;
    if (rawDays !== undefined && rawDays !== null && rawDays !== '') {
      const remainingDays = Number(rawDays);
      if (!Number.isInteger(remainingDays) || remainingDays < 0 || remainingDays > 730) {
        return res.status(400).json({ error: 'Remaining days must be a whole number between 0 and 730.' });
      }
      adjusted = new Date();
      adjusted.setDate(adjusted.getDate() + remainingDays);
      adjusted.setHours(23, 59, 59, 999);
    } else {
      if (!rawDate) return res.status(400).json({ error: 'Please select an estimated finish date or enter remaining days.' });
      adjusted = new Date(`${rawDate}T23:59:59.999`);
      if (Number.isNaN(adjusted.getTime())) return res.status(400).json({ error: 'Invalid estimated finish date.' });
    }
    usage.admin_adjusted_empty_at = adjusted;
    usage.admin_adjusted_by = req.auth.id;
    usage.admin_adjusted_at = new Date();
    const leadDays = Math.max(3, Math.min(7, Math.round((usage.average_interval_days || 60) / 10)));
    usage.reminder_at = new Date(adjusted.getTime() - leadDays * 86400000);
    usage.reminder_sent_for_order_id = null;
    usage.updated_at = new Date();
    await usage.save();
    res.json({ data: { ...usage.toJSON(), id: String(usage._id), predicted_empty_at: usage.admin_adjusted_empty_at }, error: null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/admin/lpg-usage/notify', requireAuth, async (req, res) => {
  try {
    const admin = await getAuthenticatedProfile(req);
    if (!admin?.is_admin) return res.status(403).json({ error: 'Administration Head or authorized employee access required.' });
    const usage = await models.lpg_usage_profiles.findById(String(req.body.usage_id || ''));
    if (!usage) return res.status(404).json({ error: 'Cylinder usage estimate not found.' });
    const predicted = new Date(usage.admin_adjusted_empty_at || usage.predicted_empty_at);
    const days = Math.max(0, Math.ceil((predicted.getTime() - Date.now()) / 86400000));
    const title = 'Your LPG cylinder may be nearly empty';
    const message = String(req.body.message || '').trim() || `Your ${usage.cylinder_size_kg}kg LPG cylinder may finish around ${predicted.toLocaleDateString('en-GB')}${days ? ` (about ${days} days remaining)` : ''}. Please order a refill soon.`;
    const notification = await models.notifications.create({ user_id: usage.user_id, type: 'lpg_usage_reminder', title, message, urgent: days <= 3, buzz: true });
    res.status(201).json({ data: { ...notification.toJSON(), id: String(notification._id) }, error: null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/lpg-usage', requireAuth, async (req, res) => {
  try {
    await rebuildLpgUsageProfiles();
    const now = new Date();
    const profiles = await models.lpg_usage_profiles
      .find({ user_id: req.auth.id, predicted_empty_at: { $ne: null } })
      .sort({ last_order_at: -1 })
      .lean();

    const data = profiles.map((profile) => {
      const startedAt = profile.last_order_at ? new Date(profile.last_order_at) : now;
      const predictedAt = new Date(profile.admin_adjusted_empty_at || profile.predicted_empty_at);
      const totalMs = Math.max(1, predictedAt.getTime() - startedAt.getTime());
      const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime());
      const usedPercent = Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)));
      const remainingPercent = Math.max(0, 100 - usedPercent);
      const daysRemaining = Math.max(0, Math.ceil((predictedAt.getTime() - now.getTime()) / 86400000));
      return {
        ...profile,
        predicted_empty_at: profile.admin_adjusted_empty_at || profile.predicted_empty_at,
        system_predicted_empty_at: profile.predicted_empty_at,
        is_admin_adjusted: Boolean(profile.admin_adjusted_empty_at),
        id: String(profile._id),
        used_percent: usedPercent,
        remaining_percent: remainingPercent,
        days_remaining: daysRemaining,
      };
    });

    res.set('Cache-Control', 'no-store');
    res.json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: error.message });
  }
});

app.post('/api/notifications/read', requireAuth, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    const query = ids.length ? { user_id: req.auth.id, _id: { $in: ids } } : { user_id: req.auth.id, is_read: false };
    await models.notifications.updateMany(query, { $set: { is_read: true, buzz: false, updated_at: new Date() } });
    res.json({ success: true, error: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/alerts/run', requireAuth, async (req, res) => {
  try {
    const profile = await models.profiles.findOne({ user_id: req.auth.id });
    if (!profile?.is_admin && profile?.role !== 'delivery') {
      return res.status(403).json({ error: 'Admin or delivery user only.' });
    }
    await runOrderAlertChecks();
    res.json({ success: true, error: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

async function generateUniqueEmployeeCode() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!(await models.profiles.exists({ employee_code: code }))) return code;
  }
  throw new Error('Could not generate a unique employee code.');
}

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    const value = String(emailOrPhone || '').trim().toLowerCase();
    const phoneValues = phoneLookupValues(emailOrPhone);
    let user = null;
    if (/^\d{6}$/.test(value)) {
      const employeeProfile = await models.profiles.findOne({ employee_code: value, role: 'sub_admin' });
      if (employeeProfile) user = await models.users.findById(employeeProfile.user_id);
    }
    if (!user) user = await models.users.findOne({ $or: [{ email: value }, { phone: { $in: phoneValues } }] });
    if (!user || !(await bcrypt.compare(password || '', user.password_hash))) return res.status(401).json({ error: 'Invalid login credentials' });
    const profile = await models.profiles.findOne({ user_id: user.id });
    if (profile?.is_active === false) return res.status(403).json({ error: 'This account is inactive. Please contact the Administration Head.' });
    const session = signUser(user);
    res.json({ session, user: session.user });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/auth/social', async (req, res) => {
  try {
    const provider = String(req.body.provider || '').toLowerCase();
    const accessToken = String(req.body.accessToken || '');
    const socialProfile = await fetchSocialProfile(provider, accessToken);
    const user = await signInOrCreateSocialUser(socialProfile);
    const session = signUser(user);
    res.json({ session, user: session.user });
  } catch (error) {
    res.status(error.statusCode || 401).json({ error: error.message || 'Social login failed' });
  }
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
    const { full_name, employee_position, phone, password, permissions = {} } = req.body;
    if (!full_name || !employee_position || !phone || !password) return res.status(400).json({ error: 'Employee name, position, phone and password are required.' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const normalizedPhone = normalizePhoneForSms(phone);
    const email = `${normalizedPhone}@subadmin.cylinderexpress.bd`;
    if (await models.users.findOne({ $or: [{ phone: { $in: phoneLookupValues(phone) } }, { email }] })) {
      return res.status(409).json({ error: 'A user with this phone already exists.' });
    }

    const employeeCode = await generateUniqueEmployeeCode();
    const user = await models.users.create({ email, phone: normalizedPhone, password_hash: await bcrypt.hash(password, 12) });
    const profile = await models.profiles.create({
      user_id: user.id,
      full_name,
      phone: normalizedPhone,
      email,
      is_admin: true,
      role: 'sub_admin',
      permissions: sanitizePermissions(permissions),
      employee_position: String(employee_position).trim(),
      employee_code: employeeCode,
      is_active: true,
    });

    const smsMessage = `Cylinder Express employee account created. Employee Code: ${employeeCode}. Password: ${password}. You can login with the 6-digit code and password.`;
    let sms = { sent: false, skipped: true, reason: SMS_ENABLED ? 'SMS provider failed' : 'SMS environment variables missing' };
    try {
      sms = await sendBulkSmsBdMessage(normalizedPhone, smsMessage);
    } catch (smsError) {
      sms = { sent: false, skipped: false, error: smsError.message };
      console.error('Employee credential SMS failed:', smsError.message);
    }

    res.json({ data: profile.toJSON(), sms, error: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/admin/delivery-men', requireAuth, requireAdminUserManagement, async (req, res) => {
  try {
    const { full_name, phone, password, permanent_address, permanent_plus_code, permanent_latitude, permanent_longitude } = req.body;
    if (!full_name || !phone || !password) return res.status(400).json({ error: 'Name, phone and password are required.' });
    const hasLat = permanent_latitude !== undefined && permanent_latitude !== null && String(permanent_latitude).trim() !== '';
    const hasLng = permanent_longitude !== undefined && permanent_longitude !== null && String(permanent_longitude).trim() !== '';
    if (hasLat !== hasLng) return res.status(400).json({ error: 'Both latitude and longitude are required.' });
    if (!String(permanent_address || '').trim() && !String(permanent_plus_code || '').trim() && !hasLat) {
      return res.status(400).json({ error: 'A delivery base address, Plus Code, or coordinates are required.' });
    }
    const manualLat = hasLat ? Number(permanent_latitude) : null;
    const manualLng = hasLng ? Number(permanent_longitude) : null;
    if (hasLat && (!Number.isFinite(manualLat) || manualLat < -90 || manualLat > 90 || !Number.isFinite(manualLng) || manualLng < -180 || manualLng > 180)) {
      return res.status(400).json({ error: 'Latitude must be between -90 and 90, and longitude between -180 and 180.' });
    }
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const normalizedPhone = normalizePhoneForSms(phone);
    const email = `${normalizedPhone}@delivery.cylinderexpress.bd`;
    if (await models.users.findOne({ $or: [{ phone: { $in: phoneLookupValues(phone) } }, { email }] })) {
      return res.status(409).json({ error: 'A user with this phone already exists.' });
    }

    const basePoint = hasLat ? { latitude: manualLat, longitude: manualLng, formattedAddress: permanent_address || permanent_plus_code || `Base point (${manualLat}, ${manualLng})` } : await geocodeDeliveryBase(permanent_address, permanent_plus_code);
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
      permanent_address: basePoint?.formattedAddress || permanent_address || null,
      permanent_latitude: basePoint?.latitude ?? null,
      permanent_longitude: basePoint?.longitude ?? null,
      permanent_plus_code: permanent_plus_code ? String(permanent_plus_code).trim() : null,
    });

    const smsMessage = `Cylinder Express delivery account created. Username: ${normalizedPhone}. Password: ${password}. Login and share your live location before delivery.`;
    let sms = { sent: false, skipped: true, reason: SMS_ENABLED ? 'SMS provider failed' : 'SMS environment variables missing' };
    try {
      sms = await sendBulkSmsBdMessage(normalizedPhone, smsMessage);
    } catch (smsError) {
      sms = { sent: false, skipped: false, error: smsError.message };
      console.error('Delivery credential SMS failed:', smsError.message);
    }

    res.json({ data: profile.toJSON(), sms, error: null });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});


app.patch('/api/admin/delivery-men/:profileId', requireAuth, requireAdminUserManagement, async (req, res) => {
  try {
    const update = {};
    if (req.body.full_name !== undefined) update.full_name = req.body.full_name;
    if (req.body.phone !== undefined) update.phone = req.body.phone;
    if (req.body.is_active !== undefined) update.is_active = Boolean(req.body.is_active);
    const baseChanged = req.body.permanent_address !== undefined || req.body.permanent_plus_code !== undefined || req.body.permanent_latitude !== undefined || req.body.permanent_longitude !== undefined;
    if (baseChanged) {
      const existing = await models.profiles.findOne({ _id: req.params.profileId, role: 'delivery' }).lean();
      if (!existing) return res.status(404).json({ error: 'HUB Man profile not found.' });
      const nextAddress = req.body.permanent_address !== undefined ? req.body.permanent_address : existing.permanent_address;
      const nextPlusCode = req.body.permanent_plus_code !== undefined ? req.body.permanent_plus_code : existing.permanent_plus_code;
      const nextLatRaw = req.body.permanent_latitude !== undefined ? req.body.permanent_latitude : existing.permanent_latitude;
      const nextLngRaw = req.body.permanent_longitude !== undefined ? req.body.permanent_longitude : existing.permanent_longitude;
      const hasLat = nextLatRaw !== undefined && nextLatRaw !== null && String(nextLatRaw).trim() !== '';
      const hasLng = nextLngRaw !== undefined && nextLngRaw !== null && String(nextLngRaw).trim() !== '';
      if (hasLat !== hasLng) return res.status(400).json({ error: 'Both latitude and longitude are required.' });
      if (!String(nextAddress || '').trim() && !String(nextPlusCode || '').trim() && !hasLat) {
        return res.status(400).json({ error: 'A delivery base address, Plus Code, or coordinates are required.' });
      }
      const manualLat = hasLat ? Number(nextLatRaw) : null;
      const manualLng = hasLng ? Number(nextLngRaw) : null;
      if (hasLat && (!Number.isFinite(manualLat) || manualLat < -90 || manualLat > 90 || !Number.isFinite(manualLng) || manualLng < -180 || manualLng > 180)) {
        return res.status(400).json({ error: 'Latitude must be between -90 and 90, and longitude between -180 and 180.' });
      }
      const basePoint = hasLat ? { latitude: manualLat, longitude: manualLng, formattedAddress: nextAddress || nextPlusCode || `Base point (${manualLat}, ${manualLng})` } : await geocodeDeliveryBase(nextAddress, nextPlusCode);
      update.permanent_address = basePoint?.formattedAddress || nextAddress || null;
      update.permanent_plus_code = nextPlusCode ? String(nextPlusCode).trim() : null;
      update.permanent_latitude = basePoint?.latitude ?? null;
      update.permanent_longitude = basePoint?.longitude ?? null;
    }
    update.updated_at = new Date();
    const profile = await models.profiles.findOneAndUpdate({ _id: req.params.profileId, role: 'delivery' }, update, { new: true });
    if (!profile) return res.status(404).json({ error: 'HUB Man profile not found.' });
    const userUpdate = {};
    if (req.body.phone !== undefined) userUpdate.phone = req.body.phone;
    if (req.body.password) userUpdate.password_hash = await bcrypt.hash(String(req.body.password), 12);
    if (Object.keys(userUpdate).length) await models.users.findByIdAndUpdate(profile.user_id, userUpdate);
    res.json({ data: profile.toJSON(), error: null });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

app.patch('/api/admin/subadmins/:profileId', requireAuth, requireAdminUserManagement, async (req, res) => {
  try {
    const update = {};
    if (req.body.full_name !== undefined) update.full_name = req.body.full_name;
    if (req.body.phone !== undefined) update.phone = req.body.phone;
    if (req.body.permissions !== undefined) update.permissions = sanitizePermissions(req.body.permissions);
    if (req.body.employee_position !== undefined) update.employee_position = req.body.employee_position ? String(req.body.employee_position).trim() : null;
    if (req.body.is_active !== undefined) update.is_active = Boolean(req.body.is_active);
    update.updated_at = new Date();
    const profile = await models.profiles.findByIdAndUpdate(req.params.profileId, update, { new: true });
    if (!profile) return res.status(404).json({ error: 'Employee profile not found.' });
    const userUpdate = {};
    if (req.body.phone !== undefined) userUpdate.phone = req.body.phone;
    if (req.body.password) userUpdate.password_hash = await bcrypt.hash(String(req.body.password), 12);
    if (Object.keys(userUpdate).length) await models.users.findByIdAndUpdate(profile.user_id, userUpdate);
    res.json({ data: profile.toJSON(), error: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.delete('/api/admin/accounts/:profileId', requireAuth, requireAdminPermission('account_delete'), async (req, res) => {
  try {
    const password = String(req.body?.password || '');
    if (!password) return res.status(400).json({ error: 'Your current password is required to delete an account.' });

    const actorUser = await models.users.findById(req.auth.id);
    if (!actorUser || !(await bcrypt.compare(password, actorUser.password_hash))) {
      return res.status(401).json({ error: 'Incorrect password. Account was not deleted.' });
    }

    const target = await models.profiles.findById(req.params.profileId);
    if (!target) return res.status(404).json({ error: 'Account not found.' });
    if (String(target.user_id) === String(req.auth.id)) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }
    if (target.role === 'admin' || (target.is_admin && target.role !== 'sub_admin')) {
      return res.status(403).json({ error: 'The Administration Head account cannot be deleted here.' });
    }

    const targetUserId = String(target.user_id);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (target.role === 'customer') {
          const customerOrders = await models.orders.find({ user_id: targetUserId }).select('_id').session(session);
          const orderIds = customerOrders.map((o) => String(o._id));
          if (orderIds.length) {
            await models.order_items.deleteMany({ order_id: { $in: orderIds } }, { session });
            await models.notifications.deleteMany({ order_id: { $in: orderIds } }, { session });
          }
          await Promise.all([
            models.orders.deleteMany({ user_id: targetUserId }, { session }),
            models.addresses.deleteMany({ user_id: targetUserId }, { session }),
            models.service_bookings.deleteMany({ user_id: targetUserId }, { session }),
            models.customer_locations.deleteMany({ user_id: targetUserId }, { session }),
            models.customer_location_points.deleteMany({ user_id: targetUserId }, { session }),
            models.customer_admin_messages.deleteMany({ $or: [{ customer_user_id: targetUserId }, { sender_id: targetUserId }] }, { session }),
            models.lpg_usage_profiles.deleteMany({ user_id: targetUserId }, { session }),
            models.notifications.deleteMany({ user_id: targetUserId }, { session }),
          ]);
        } else if (target.role === 'delivery') {
          await models.orders.updateMany({ delivery_man_id: targetUserId, status: { $nin: ['delivered', 'cancelled'] } }, { $set: { delivery_man_id: null, delivery_assigned_at: null, updated_at: new Date() } }, { session });
          await Promise.all([
            models.delivery_locations.deleteMany({ user_id: targetUserId }, { session }),
            models.delivery_location_points.deleteMany({ user_id: targetUserId }, { session }),
            models.delivery_admin_messages.deleteMany({ $or: [{ delivery_user_id: targetUserId }, { sender_id: targetUserId }] }, { session }),
            models.notifications.deleteMany({ user_id: targetUserId }, { session }),
          ]);
        } else if (target.role === 'sub_admin') {
          await Promise.all([
            models.delivery_admin_messages.deleteMany({ sender_id: targetUserId }, { session }),
            models.customer_admin_messages.deleteMany({ sender_id: targetUserId }, { session }),
            models.notifications.deleteMany({ user_id: targetUserId }, { session }),
          ]);
        }

        await models.profiles.deleteOne({ _id: target._id }, { session });
        await models.users.deleteOne({ _id: targetUserId }, { session });
      });
    } finally {
      await session.endSession();
    }

    res.json({ data: { deleted: true, role: target.role, name: target.full_name }, error: null });
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

      if (req.params.table === 'orders') {
        for (const rawItem of payload) {
          const item = ensureUserOwnedPayload(req.params.table, rawItem, userId);
          const customerId = item.user_id || userId;
          const customerProfile = customerId ? await models.profiles.findOne({ user_id: customerId }) : null;
          if (!customerProfile || !isRealCustomerPhone(customerProfile.phone)) {
            return res.status(400).json({ data: null, error: 'Please add and verify your phone number before placing an order.' });
          }
          if (item.promo_code) {
            const code = String(item.promo_code).trim().toUpperCase();
            const offer = await models.offers.findOne({ code, is_active: true });
            if (!offer) {
              return res.status(400).json({ data: null, error: 'Invalid or expired promo code.' });
            }
            if (offer.valid_until && new Date(offer.valid_until) < new Date()) {
              return res.status(400).json({ data: null, error: 'This promo code has expired.' });
            }

            const maxUses = Math.max(1, Number(offer.max_uses_per_customer || 1));
            if (customerId) {
              const usedCount = await models.orders.countDocuments({
                user_id: customerId,
                promo_code: code,
                status: { $ne: 'cancelled' },
              });
              if (usedCount >= maxUses) {
                return res.status(400).json({
                  data: null,
                  error: maxUses === 1
                    ? 'You have already used this promo code.'
                    : `You have already used this promo code ${maxUses} times.`,
                });
              }
            }
            rawItem.promo_code = code;
          }
        }
      }

      const docs = await Model.insertMany(payload.map((item) => ({
        ...ensureUserOwnedPayload(req.params.table, item, userId),
        updated_at: new Date(),
      })));
      data = docs.map((d) => d.toJSON());

      if (req.params.table === 'orders') {
        await Promise.all(docs.map(async (order) => {
          const orderNumber = String(order.id).slice(-6).toUpperCase();
          const totalPayable = Number(order.total_amount || 0)
            + Number(order.delivery_fee || 0)
            + Number(order.floor_charge || 0)
            - Number(order.discount_amount || 0);
          const address = order.address_id
            ? await models.addresses.findById(order.address_id).catch(() => null)
            : null;
          const addressText = address
            ? [address.address_line1, address.area, address.city, address.district].filter(Boolean).join(', ')
            : 'Customer address selected';

          await notifyAdmins({
            order_id: order.id,
            type: 'new_order_admin',
            title: 'New order received',
            message: `New order #${orderNumber} placed. Amount: ৳${totalPayable.toLocaleString('en-BD')}. Address: ${addressText}. Confirm or assign delivery now.`,
            urgent: true,
            buzz: true,
          });
        }));
      }
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
      const previousDocs = req.params.table === 'orders' ? await Model.find(query) : [];
      const updatePayload = { ...body, updated_at: new Date() };
      if (req.params.table === 'orders' && body?.status) {
        if (body.status === 'confirmed') updatePayload.confirmed_at = new Date();
        if (body.status === 'processing') {
          updatePayload.delivery_accepted_at = body.delivery_accepted_at ? new Date(body.delivery_accepted_at) : new Date();
          updatePayload.delivery_accept_reminder_last_sent_at = null;
        }
        if (body.status === 'delivered') updatePayload.delivered_at = new Date();
        if (body.status === 'cancelled') updatePayload.cancelled_at = new Date();
      }
      if (req.params.table === 'orders' && body?.delivery_man_id !== undefined) {
        if (body.delivery_man_id) {
          updatePayload.delivery_assigned_at = new Date();
          updatePayload.delivery_accepted_at = null;
          updatePayload.delivery_accept_reminder_last_sent_at = null;
          updatePayload.delivery_delivered_reminder_last_sent_at = null;
          updatePayload.delivery_delay_notified_at = null;
        } else {
          updatePayload.delivery_assigned_at = null;
          updatePayload.delivery_accepted_at = null;
          updatePayload.delivery_accept_reminder_last_sent_at = null;
          updatePayload.delivery_delivered_reminder_last_sent_at = null;
        }
      }
      if (req.params.table === 'profiles' && body?.phone !== undefined) {
        const normalizedPhone = normalizeCustomerPhone(body.phone);
        if (!isRealCustomerPhone(normalizedPhone)) {
          return res.status(400).json({ data: null, error: 'Invalid Bangladesh phone number.' });
        }
        updatePayload.phone = normalizedPhone;
      }

      await Model.updateMany(query, updatePayload);
      const updatedDocs = await Model.find(query);
      data = updatedDocs.map((d) => d.toJSON());

      if (req.params.table === 'profiles' && body?.phone !== undefined) {
        for (const profile of updatedDocs) {
          await models.users.findByIdAndUpdate(profile.user_id, { phone: updatePayload.phone });
        }
        data = updatedDocs.map((d) => d.toJSON());
      }

      if (req.params.table === 'orders') {
        const previousById = new Map(previousDocs.map((doc) => [doc.id, doc]));
        for (const order of updatedDocs) {
          const previous = previousById.get(order.id);
          const previousDeliveryManId = String(previous?.delivery_man_id || '');
          const currentDeliveryManId = String(order.delivery_man_id || '');

          if (body?.status && previous?.status !== order.status && ['confirmed', 'delivered'].includes(String(order.status))) {
            await notifyOrderCustomer(order, order.status);
          }

          if (body?.status === 'processing') {
            await silenceOrderNotifications(order.id, ['delivery_assigned', 'delivery_accept_overdue'], currentDeliveryManId);
          }

          if (['delivered', 'cancelled'].includes(String(body?.status || ''))) {
            await silenceOrderNotifications(order.id, [
              'delivery_assigned',
              'delivery_accept_overdue',
              'delivery_not_delivered_20m_admin',
            ]);
          }

          if (body?.delivery_man_id !== undefined && previousDeliveryManId !== currentDeliveryManId) {
            if (previousDeliveryManId) {
              await silenceOrderNotifications(order.id, ['delivery_assigned', 'delivery_accept_overdue'], previousDeliveryManId);
            }
            await silenceOrderNotifications(order.id, ['delivery_not_delivered_20m_admin']);
            if (order.delivery_man_id) {
              await notifyDeliveryManAssignment(order);
            }
          }
        }
      }

      if (req.params.table === 'orders' && ['delivered', 'cancelled'].includes(String(body?.status || ''))) {
        const orderIds = updatedDocs.map((doc) => doc.id);
        const userIds = updatedDocs.map((doc) => doc.user_id).filter(Boolean);
        await models.customer_locations.updateMany(
          { $or: [{ active_order_id: { $in: orderIds } }, { user_id: { $in: userIds } }] },
          { $set: { active_order_id: null, is_sharing: false, updated_at: new Date() } }
        );

        // HUB Man's device location sharing stays ON after completing an order.
        // Customer visibility is controlled by order status on the customer app, so delivered/cancelled
        // orders no longer display the HUB man's live location while the driver can continue
        // sharing for the next assigned delivery without turning location on again.
      }
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

function phoneLookupValues(phone) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  const normalized = normalizePhoneForSms(raw);
  const local = normalized.startsWith('880') ? `0${normalized.slice(3)}` : digits;
  return Array.from(new Set([raw, digits, normalized, local].filter(Boolean)));
}

function isRealCustomerPhone(phone) {
  if (!phone) return false;
  const value = String(phone).trim();
  if (!value || value.includes(':') || value.includes('@')) return false;
  const digits = value.replace(/\D/g, '');
  return /^01[3-9]\d{8}$/.test(digits) || /^8801[3-9]\d{8}$/.test(digits);
}

function normalizeCustomerPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (/^8801[3-9]\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  return digits;
}

async function sendBulkSmsBdOtp(phone, otp) {
  return sendBulkSmsBdMessage(phone, `Your Cylinder Express OTP is ${otp}. It will expire in 5 minutes.`);
}

app.post('/functions/v1/send-otp', async (req, res) => {
  try {
    const { phone, purpose } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'Phone number is required.' });

    const normalizedPhone = normalizeCustomerPhone(phone);
    if (!/^01[3-9]\d{8}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: 'Enter a valid Bangladesh mobile number.' });
    }

    if (purpose === 'password-reset') {
      const account = await models.users.findOne({ phone: { $in: phoneLookupValues(normalizedPhone) } });
      if (!account) return res.status(404).json({ error: 'No account found with this phone number.' });
    }

    if (process.env.NODE_ENV === 'production' && !SMS_ENABLED) {
      console.error('OTP SMS is disabled: BULKSMSBD_API_KEY or BULKSMSBD_SENDER_ID is missing.');
      return res.status(503).json({
        error: 'SMS service is not configured. Please contact Cylinder Express support.',
        code: 'SMS_NOT_CONFIGURED',
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await models.otp_verifications.deleteMany({ phone: { $in: phoneLookupValues(normalizedPhone) }, used: false });
    await models.otp_verifications.create({ phone: normalizedPhone, otp, expires_at: new Date(Date.now() + 5 * 60 * 1000) });

    const smsResult = await sendBulkSmsBdOtp(normalizedPhone, otp);
    if (process.env.NODE_ENV !== 'production') console.log(`Cylinder Express OTP for ${normalizedPhone}: ${otp}`);
    return res.json({
      success: true,
      message: smsResult.sent ? 'OTP sent successfully' : 'Development OTP generated',
      ...(process.env.NODE_ENV !== 'production' ? { otp } : {}),
    });
  } catch (error) {
    console.error('OTP SMS sending failed:', error);
    return res.status(502).json({
      error: 'OTP could not be sent. Check the SMS configuration and try again.',
      code: 'OTP_SEND_FAILED',
    });
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
  const { phone, otp } = req.body || {};
  const normalizedPhone = normalizeCustomerPhone(phone);
  const record = await models.otp_verifications.findOne({
    phone: { $in: phoneLookupValues(normalizedPhone) },
    used: false,
  }).sort({ created_at: -1 });
  if (!record || record.otp !== String(otp || '').trim() || record.expires_at < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired OTP.' });
  }
  record.used = true;
  await record.save();
  const token = crypto.randomUUID();
  await models.password_reset_sessions.create({
    phone: normalizedPhone,
    token,
    expires_at: new Date(Date.now() + 15 * 60 * 1000),
  });
  res.json({ success: true, reset_token: token });
});

app.post('/functions/v1/reset-password', async (req, res) => {
  const { phone, reset_token, new_password } = req.body || {};
  const normalizedPhone = normalizeCustomerPhone(phone);
  if (!new_password || String(new_password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  const session = await models.password_reset_sessions.findOne({
    phone: { $in: phoneLookupValues(normalizedPhone) },
    token: reset_token,
    used: false,
  });
  if (!session || session.expires_at < new Date()) return res.status(400).json({ error: 'Invalid or expired reset token.' });
  const user = await models.users.findOne({ phone: { $in: phoneLookupValues(normalizedPhone) } });
  if (!user) return res.status(404).json({ error: 'No account found with this phone number.' });
  user.password_hash = await bcrypt.hash(new_password, 12);
  await user.save();
  session.used = true;
  await session.save();
  res.json({ success: true, message: 'Password updated successfully' });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function safeUploadFileName(value) {
  return String(value || 'upload')
    .replace(/[^a-zA-Z0-9._/-]/g, '-')
    .replaceAll('/', '-')
    .slice(0, 180);
}

app.post('/api/uploads', upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: 'No file uploaded.' });
    const requestedName = safeUploadFileName(req.body.path || req.file.originalname);
    const asset = await models.upload_assets.create({
      filename: requestedName,
      original_name: req.file.originalname || requestedName,
      bucket: req.body.bucket || 'uploads',
      content_type: req.file.mimetype || 'application/octet-stream',
      size: req.file.size || req.file.buffer.length,
      data: req.file.buffer,
    });
    res.json({ path: asset.id, url: `/uploads/${asset.id}` });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Upload failed.' });
  }
});

app.get('/uploads/:assetId', async (req, res, next) => {
  try {
    const assetId = String(req.params.assetId || '');
    if (!mongoose.Types.ObjectId.isValid(assetId)) return next();
    const asset = await models.upload_assets.findById(assetId);
    if (!asset) return next();
    res.setHeader('Content-Type', asset.content_type || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(asset.data);
  } catch (error) {
    next(error);
  }
});

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

mongoose.connect(MONGODB_URI).then(async () => {
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
}).catch((error) => {
  console.error('MongoDB connection failed:', error.message);
  process.exit(1);
});
