export const ADMIN_PERMISSIONS = ['dashboard', 'orders', 'products', 'offers', 'hero', 'locations', 'users', 'account_delete', 'delivery_chat', 'customer_chat', 'cylinder_usage'];

export function sanitizePermissions(input = {}) {
  return ADMIN_PERMISSIONS.reduce((acc, key) => { acc[key] = Boolean(input?.[key]); return acc; }, {});
}

export function hasAdminPermission(profile, permission) {
  if (!profile || !['admin', 'sub_admin'].includes(profile.role)) return false;
  if (profile.role === 'admin') return true;
  return Boolean(profile.permissions?.[permission]);
}
