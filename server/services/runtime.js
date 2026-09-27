import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { models } from '../models/index.js';
import { config } from '../config/env.js';
import { ADMIN_PERMISSIONS, sanitizePermissions, hasAdminPermission } from '../utilities/permissions.js';

const { JWT_SECRET, BULKSMSBD_API_URL, BULKSMSBD_API_KEY, BULKSMSBD_SENDER_ID, SMS_ENABLED, CHATBOT_API_KEY, CHATBOT_API_URL, CHATBOT_MODEL, GOOGLE_GEOCODING_API_KEY, CHATBOT_ENABLED } = config;
export async function geocodeDeliveryBase(permanentAddress, permanentPlusCode) {
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


export function signUser(user) {
  const safe = { id: user.id, email: user.email || null, phone: user.phone || null };
  return { access_token: jwt.sign(safe, JWT_SECRET, { expiresIn: '7d' }), user: safe };
}

export async function fetchSocialProfile(provider, accessToken) {
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

export async function signInOrCreateSocialUser(socialProfile) {
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
    profile = await models.profiles.create({
      user_id: user.id,
      full_name: socialProfile.name,
      phone: socialPhone,
      email: socialProfile.email || null,
      avatar_url: socialProfile.avatar || null,
      is_admin: false,
      role: 'customer',
      permissions: {},
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



export async function ensureAdministrationHeadAccount() {
  const email = String(config.ADMIN_HEAD_EMAIL || '').trim().toLowerCase();
  const password = String(config.ADMIN_HEAD_PASSWORD || '');
  if (!email) {
    console.warn('[admin-bootstrap] ADMIN_HEAD_EMAIL is not configured.');
    return null;
  }

  let user = await models.users.findOne({ email });
  if (!user) {
    if (!password) {
      console.warn('[admin-bootstrap] Administration Head account does not exist and ADMIN_HEAD_PASSWORD is not configured.');
      return null;
    }
    user = await models.users.create({
      email,
      phone: null,
      password_hash: await bcrypt.hash(password, 12),
    });
  }

  if (password && !(await bcrypt.compare(password, user.password_hash))) {
    user.password_hash = await bcrypt.hash(password, 12);
    await user.save();
  }

  let profile = await models.profiles.findOne({ user_id: user.id });
  const allPermissions = sanitizePermissions(Object.fromEntries(ADMIN_PERMISSIONS.map((key) => [key, true])));
  if (!profile) {
    profile = await models.profiles.create({
      user_id: user.id,
      full_name: config.ADMIN_HEAD_FULL_NAME,
      email,
      phone: user.phone || null,
      is_admin: true,
      role: 'admin',
      permissions: allPermissions,
      is_active: true,
    });
  } else {
    profile.full_name = profile.full_name || config.ADMIN_HEAD_FULL_NAME;
    profile.email = email;
    profile.is_admin = true;
    profile.role = 'admin';
    profile.permissions = allPermissions;
    profile.is_active = true;
    await profile.save();
  }

  // Only the configured account may hold the primary Administration Head role.
  await models.profiles.updateMany(
    { _id: { $ne: profile._id }, role: 'admin' },
    { $set: { role: 'customer', is_admin: false, permissions: {} } }
  );

  return profile;
}

export async function getOrderAdmins() {
  const admins = await models.profiles.find({ is_admin: true, is_active: { $ne: false } });
  return admins.filter((profile) => hasAdminPermission(profile, 'orders'));
}

export async function createNotification({ user_id, role_target = null, order_id = null, type = 'info', title, message, urgent = false, buzz = false }) {
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

export async function silenceOrderNotifications(orderId, types = [], userId = null) {
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

export async function notifyAdmins(payload) {
  const admins = await getOrderAdmins();
  await Promise.all(admins.map((admin) => createNotification({ ...payload, user_id: admin.user_id, role_target: 'admin' })));
}

export async function notifyOrderCustomer(order, status) {
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

export async function notifyDeliveryManAssignment(order) {
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


export function parseCylinderSizeKg(value) {
  const match = String(value || '').toLowerCase().match(/(\d+(?:\.\d+)?)\s*kg/);
  return match ? Number(match[1]) : null;
}

export function defaultUsageDaysForKg(sizeKg) {
  if (!Number.isFinite(sizeKg)) return 60;
  if (sizeKg <= 6) return 45;
  if (sizeKg <= 13) return 60;
  if (sizeKg <= 20) return 70;
  if (sizeKg <= 35) return 80;
  return 90;
}

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function householdUsageDaysForKg(sizeKg, profile) {
  const familyMembers = Math.max(1, Math.min(30, Number(profile?.family_members || 4)));
  const cookingTimes = Math.max(1, Math.min(10, Number(profile?.daily_cooking_times || 3)));
  // Practical household estimate. It is refined automatically from actual reorder history.
  const estimatedDailyKg = 0.035 + (familyMembers * 0.018) + (cookingTimes * 0.026);
  return Math.round(Math.max(10, Math.min(240, sizeKg / estimatedDailyKg)));
}

export async function rebuildLpgUsageProfiles() {
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
    const customerProfile = await models.profiles.findOne({ user_id: userId }).lean();
    const householdEstimate = householdUsageDaysForKg(sizeKg, customerProfile);
    const fallbackEstimate = customerProfile?.family_members && customerProfile?.daily_cooking_times
      ? householdEstimate
      : defaultUsageDaysForKg(sizeKg);
    // Blend household/cooking data with learned reorder intervals. More order history gets more weight.
    const estimatedDays = intervals.length >= 2
      ? Math.round((learned * 0.8) + (householdEstimate * 0.2))
      : intervals.length === 1
        ? Math.round((learned * 0.6) + (householdEstimate * 0.4))
        : Math.round(fallbackEstimate);
    const boundedEstimatedDays = Math.max(10, Math.min(240, estimatedDays));
    const last = recent[recent.length - 1];
    const predictedEmptyAt = new Date(last.date.getTime() + boundedEstimatedDays * 86400000);
    const reminderAt = new Date(predictedEmptyAt.getTime() - 3 * 86400000);
    const confidence = intervals.length >= 2 ? 'high' : intervals.length === 1 ? 'medium' : 'low';

    const existing = await models.lpg_usage_profiles.findOne({ user_id: userId, cylinder_size_kg: sizeKg });
    const lastChanged = !existing || String(existing.last_order_id || '') !== last.orderId;
    await models.lpg_usage_profiles.findOneAndUpdate(
      { user_id: userId, cylinder_size_kg: sizeKg },
      {
        $set: {
          sample_count: recent.length,
          average_interval_days: boundedEstimatedDays,
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

export async function runLpgEmptyReminderChecks() {
  await rebuildLpgUsageProfiles();
  const now = new Date();
  const dueProfiles = await models.lpg_usage_profiles.find({
    reminder_at: { $lte: now },
    predicted_empty_at: { $gte: new Date(now.getTime() - 14 * 86400000) },
    $expr: { $ne: ['$reminder_sent_for_order_id', '$last_order_id'] },
  }).limit(100);

  for (const profile of dueProfiles) {
    const daysLeft = Math.max(0, Math.ceil((profile.predicted_empty_at.getTime() - now.getTime()) / 86400000));
    const confidenceText = profile.confidence === 'high' ? 'based on your recent ordering pattern' : 'based on your household size and cooking frequency';
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

export async function runOrderAlertChecks() {
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

export async function sendBulkSmsBdMessage(phone, message) {
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


export async function getAuthenticatedProfile(req) {
  return models.profiles.findOne({ user_id: req.auth.id });
}



export function chatbotEmergencyReply(message, language = 'en') {
  const q = String(message || '').toLowerCase();
  const leak = /gas.{0,12}(leak|smell|odor|gondho)|(?:leak|smell|odor|gondho).{0,12}gas|গ্যাস.{0,12}(লিক|গন্ধ)|(?:লিক|গন্ধ).{0,12}গ্যাস/.test(q);
  if (!leak) return null;
  return language === 'bn'
    ? '⚠️ গ্যাস লিক বা গ্যাসের গন্ধ পেলে এখনই আগুন, ম্যাচ, লাইটার ও সিগারেট বন্ধ করুন। কোনো বৈদ্যুতিক সুইচ, ফ্যান, চার্জার বা যন্ত্র চালু/বন্ধ করবেন না। নিরাপদ হলে চুলার নব ও রেগুলেটর বন্ধ করুন, দরজা-জানালা হাতে খুলুন, সবাইকে বাইরে নিয়ে যান এবং বাইরে থেকে 999 বা Cylinder Express কাস্টমার কেয়ারে কল করুন। নিজে মেরামত করবেন না এবং প্রশিক্ষিত টেকনিশিয়ান পরীক্ষা না করা পর্যন্ত আবার ব্যবহার করবেন না।'
    : '⚠️ If you smell gas or suspect an LPG leak, extinguish flames, matches, lighters, and cigarettes immediately. Do not operate electrical switches, fans, chargers, or appliances. If safe, close the stove knobs and regulator, open doors and windows manually, move everyone outside, and call 999 or Cylinder Express support from outdoors. Do not repair or reuse the system until a trained technician has inspected it.';
}

export function normalizeChatText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9\u0980-\u09ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function localChatbotReply(message, language = 'en') {
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


export function normalizeMongoField(field) {
  return field === 'id' ? '_id' : field;
}

export function buildMongoQuery(filters = []) {
  const query = {};
  for (const filter of filters) {
    const field = normalizeMongoField(filter.field);
    if (filter.op === 'eq') query[field] = filter.value;
    if (filter.op === 'in') query[field] = { $in: filter.value };
    if (filter.op === 'gte') query[field] = { $gte: new Date(filter.value) };
  }
  return query;
}

export function getOptionalAuthUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET).id || null;
  } catch {
    return null;
  }
}

export function ensureUserOwnedPayload(table, item, userId) {
  const userOwnedTables = new Set(['addresses', 'orders', 'service_bookings', 'customer_locations', 'customer_location_points', 'delivery_locations', 'delivery_location_points']);
  if (!userOwnedTables.has(table) || !userId || item.user_id) return item;
  return { ...item, user_id: userId };
}

export async function decorate(table, rows, select = '') {
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


export async function generateUniqueEmployeeCode() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!(await models.profiles.exists({ employee_code: code }))) return code;
  }
  throw new Error('Could not generate a unique employee code.');
}


export function normalizePhoneForSms(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return `88${digits}`;
  if (digits.length === 10 && digits.startsWith('1')) return `880${digits}`;
  return digits;
}

export function phoneLookupValues(phone) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  const normalized = normalizePhoneForSms(raw);
  const local = normalized.startsWith('880') ? `0${normalized.slice(3)}` : digits;
  return Array.from(new Set([raw, digits, normalized, local].filter(Boolean)));
}

export function isRealCustomerPhone(phone) {
  if (!phone) return false;
  const value = String(phone).trim();
  if (!value || value.includes(':') || value.includes('@')) return false;
  const digits = value.replace(/\D/g, '');
  return /^01[3-9]\d{8}$/.test(digits) || /^8801[3-9]\d{8}$/.test(digits);
}

export function normalizeCustomerPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (/^8801[3-9]\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  return digits;
}

export async function sendBulkSmsBdOtp(phone, otp) {
  return sendBulkSmsBdMessage(phone, `Your Cylinder Express OTP is ${otp}. It will expire in 5 minutes.`);
}


export async function backfillProfileRolesAndPermissions() {
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

export async function backfillOrderUserIds() {
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

export async function ensureDefaultCatalog() {
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

