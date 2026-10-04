import mongoose from 'mongoose';

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
  phone: { type: String, default: null, index: true },
  email: { type: String, default: null },
  avatar_url: { type: String, default: null },
  family_members: { type: Number, default: null, min: 1, max: 30 },
  daily_cooking_times: { type: Number, default: null, min: 1, max: 10 },
  is_admin: { type: Boolean, default: false },
  role: { type: String, enum: ['customer', 'admin', 'sub_admin', 'delivery'], default: 'customer', index: true },
  permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
  employee_position: { type: String, default: null, trim: true },
  employee_code: { type: String, default: null, trim: true },
  is_active: { type: Boolean, default: true },
  permanent_address: { type: String, default: null },
  permanent_latitude: { type: Number, default: null },
  permanent_longitude: { type: Number, default: null },
  permanent_plus_code: { type: String, default: null, trim: true },
  ...common,
}, { toJSON });

ProfileSchema.index(
  { employee_code: 1 },
  {
    name: 'employee_code_unique_nonempty',
    unique: true,
    partialFilterExpression: { employee_code: { $type: 'string', $gt: '' } },
  }
);

const CategorySchema = new mongoose.Schema({ name: String, slug: String, icon: String, description: String, sort_order: Number, created_at: { type: Date, default: Date.now } }, { toJSON });
const ProductSchema = new mongoose.Schema({ category_id: { type: String, index: true }, name: String, description: String, price: Number, gas_price: { type: Number, default: null }, bottle_price: { type: Number, default: null }, image_url: String, type: String, company_name: String, size: String, valve_size: String, valve_connection: String, unit: { type: String, default: 'piece' }, is_bestseller: Boolean, is_available: Boolean, sort_order: Number, ...common }, { toJSON });
const AddressSchema = new mongoose.Schema({ user_id: { type: String, index: true }, label: String, address_line1: String, address_line2: String, city: String, district: String, area: String, postal_code: String, latitude: Number, longitude: Number, is_default: Boolean, ...common }, { toJSON });
const OrderSchema = new mongoose.Schema({
  user_id: { type: String, index: true },
  address_id: { type: String, index: true },
  delivery_man_id: { type: String, default: null, index: true },
  status: { type: String, default: 'pending', index: true },
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
const OrderItemSchema = new mongoose.Schema({ order_id: { type: String, index: true }, product_id: { type: String, index: true }, quantity: Number, unit_price: Number, selected_order_type: String, selected_valve_size: String, selected_valve_connection: String, created_at: { type: Date, default: Date.now } }, { toJSON });
const ServiceBookingSchema = new mongoose.Schema({ user_id: { type: String, index: true }, product_id: { type: String, index: true }, address_id: { type: String, index: true }, status: { type: String, default: 'pending' }, scheduled_date: String, scheduled_time: String, notes: String, ...common }, { toJSON });
const OfferSchema = new mongoose.Schema({ title: String, description: String, badge_text: String, discount_type: String, discount_value: Number, code: String, product_id: String, category_slug: String, max_uses_per_customer: { type: Number, default: 1 }, bg_from: String, bg_to: String, image_url: String, valid_from: { type: Date, default: Date.now }, valid_until: Date, is_active: Boolean, sort_order: Number, created_at: { type: Date, default: Date.now } }, { toJSON });
const HeroSlideSchema = new mongoose.Schema({ title: String, subtitle: String, image_url: { type: String, required: true }, sort_order: { type: Number, default: 0 }, is_active: { type: Boolean, default: true }, ...common }, { toJSON });
const PartnerBrandSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, logo_url: { type: String, required: true }, sort_order: { type: Number, default: 0, index: true }, is_active: { type: Boolean, default: true, index: true }, ...common }, { toJSON });
const UploadAssetSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  original_name: { type: String, default: null },
  bucket: { type: String, default: 'uploads', index: true },
  content_type: { type: String, default: 'application/octet-stream' },
  size: { type: Number, default: 0 },
  data: { type: Buffer, required: true },
  created_at: { type: Date, default: Date.now },
}, { toJSON });
const OtpSchema = new mongoose.Schema({ phone: { type: String, index: true }, otp: String, used: { type: Boolean, default: false }, expires_at: Date, created_at: { type: Date, default: Date.now } }, { toJSON });
const PasswordResetSchema = new mongoose.Schema({ phone: { type: String, index: true }, token: { type: String, index: true }, used: { type: Boolean, default: false }, expires_at: Date, created_at: { type: Date, default: Date.now } }, { toJSON });
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


OtpSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
PasswordResetSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
OrderSchema.index({ user_id: 1, created_at: -1 });
OrderSchema.index({ status: 1, created_at: -1 });
OrderSchema.index({ delivery_man_id: 1, status: 1, created_at: -1 });
ProductSchema.index({ category_id: 1, is_available: 1, sort_order: 1 });
NotificationSchema.index({ user_id: 1, created_at: -1 });
NotificationSchema.index({ user_id: 1, is_read: 1, created_at: -1 });
NotificationSchema.index({ role_target: 1, is_read: 1, created_at: -1 });

const JobLockSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, index: true },
  owner: { type: String, required: true },
  locked_until: { type: Date, required: true, index: true },
  updated_at: { type: Date, default: Date.now },
}, { toJSON });

export const models = {
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
  partner_brands: mongoose.model('PartnerBrand', PartnerBrandSchema),
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
  job_locks: mongoose.model('JobLock', JobLockSchema),
};

