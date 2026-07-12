export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  role?: 'customer' | 'admin' | 'sub_admin' | 'delivery';
  permissions?: Record<string, boolean>;
  is_active?: boolean;
  permanent_address?: string | null;
  permanent_latitude?: number | null;
  permanent_longitude?: number | null;
  permanent_plus_code?: string | null;
  created_at: string;
  updated_at: string;
}


export interface HeroSlide {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  image_url: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  type: 'new' | 'refill' | 'service';
  company_name: string | null;
  size: string | null;
  valve_size: string | null;
  valve_connection: string | null;
  unit: string;
  is_bestseller: boolean;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category?: Category;
  active_offer?: Offer | null;
}


export interface Address {
  id: string;
  user_id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  district: string | null;
  area: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  address_id: string | null;
  delivery_man_id?: string | null;
  status: 'pending' | 'confirmed' | 'processing' | 'delivered' | 'cancelled';
  total_amount: number;
  delivery_fee: number;
  floor_number: number | null;
  floor_charge: number;
  promo_code: string | null;
  discount_amount: number;
  notes: string | null;
  delivery_assigned_at?: string | null;
  delivery_accepted_at?: string | null;
  delivery_accept_reminder_last_sent_at?: string | null;
  delivery_delivered_reminder_last_sent_at?: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  address?: Address;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  selected_order_type?: 'new' | 'refill' | null;
  selected_valve_size?: string | null;
  selected_valve_connection?: string | null;
  created_at: string;
  product?: Product;
}

export interface ServiceBooking {
  id: string;
  user_id: string;
  product_id: string;
  address_id: string | null;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_date: string | null;
  scheduled_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product?: Product;
  address?: Address;
}

export interface CartItem {
  cart_key: string;
  product: Product;
  quantity: number;
  selected_valve_size?: string | null;
  selected_valve_connection?: string | null;
  selected_order_type?: 'new' | 'refill' | null;
}

export interface Offer {
  id: string;
  title: string;
  description: string | null;
  badge_text: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  code: string | null;
  product_id: string | null;
  category_slug: string | null;
  max_uses_per_customer: number | null;
  bg_from: string;
  bg_to: string;
  image_url: string | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'newest';
export type TypeFilter = 'all' | 'new' | 'refill' | 'service';


export type AdminPermissionKey = 'dashboard' | 'orders' | 'products' | 'offers' | 'locations' | 'users';

export interface DeliveryLocation {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  is_sharing: boolean;
  last_seen: string;
  updated_at: string;
}

export interface LocationPoint {
  id: string;
  user_id: string;
  order_id: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recorded_at: string;
  created_at: string;
}

export const ADMIN_PERMISSION_LABELS: Record<AdminPermissionKey, string> = {
  dashboard: 'Dashboard',
  orders: 'Orders',
  products: 'Products',
  offers: 'Offers',
  locations: 'Live Locations',
  users: 'Users & Sub-admins',
};

export function profileHasPermission(profile: Profile | null | undefined, permission: AdminPermissionKey) {
  if (!profile?.is_admin || profile.is_active === false) return false;
  if (profile.role !== 'sub_admin') return true;
  return Boolean(profile.permissions?.[permission]);
}
