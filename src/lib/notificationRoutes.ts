import { Profile } from './types';
import { ADMIN_DASHBOARD_PATH, DELIVERY_DASHBOARD_PATH, adminPath } from './secureRoutes';

export type AppNotificationItem = {
  id: string;
  user_id: string;
  order_id?: string | null;
  type: string;
  title?: string;
  message?: string;
};

export function getNotificationTargetPath(notification: AppNotificationItem, profile?: Profile | null) {
  const type = String(notification.type || '').toLowerCase();
  const title = String(notification.title || '').toLowerCase();
  const message = String(notification.message || '').toLowerCase();
  const text = `${type} ${title} ${message}`;

  if (type.includes('delivery_assigned') || type.includes('delivery_accept') || profile?.role === 'delivery') {
    return DELIVERY_DASHBOARD_PATH;
  }

  if (
    type.includes('admin_') ||
    type.includes('new_order_admin') ||
    type.includes('not_delivered') ||
    text.includes('assign another') ||
    text.includes('confirm or assign') ||
    text.includes('order confirmation overdue')
  ) {
    return adminPath('orders');
  }

  if (type.startsWith('order_') || notification.order_id || text.includes('order #')) {
    return profile?.is_admin ? adminPath('orders') : '/orders';
  }

  if (type.includes('offer') || type.includes('promo') || text.includes('offer') || text.includes('promo')) {
    return profile?.is_admin ? adminPath('offers') : '/offers';
  }

  if (type.includes('lpg_refill_prediction')) {
    return '/products?category=lpg-cylinders';
  }

  if (type.includes('product') || text.includes('product')) {
    return profile?.is_admin ? adminPath('products') : '/products';
  }

  if (type.includes('address') || text.includes('address')) {
    return '/addresses';
  }

  if (type.includes('location') || text.includes('location')) {
    return profile?.is_admin ? adminPath('locations') : '/orders';
  }

  if (type.includes('user') || type.includes('profile') || text.includes('profile')) {
    return profile?.is_admin ? adminPath('users') : '/profile';
  }

  if (profile?.is_admin) return ADMIN_DASHBOARD_PATH;
  return '/home';
}
