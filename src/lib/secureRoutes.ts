function normalizePrivateRoute(value: unknown, fallback: string) {
  const raw = String(value || '').trim();
  const selected = raw || fallback;
  const withSlash = selected.startsWith('/') ? selected : `/${selected}`;
  return withSlash.replace(/\/+/g, '/').replace(/\/$/, '') || fallback;
}

export const ADMIN_LOGIN_PATH = normalizePrivateRoute(
  import.meta.env.VITE_ADMIN_LOGIN_PATH,
  '/cx-owner-login-72939'
);

export const ADMIN_DASHBOARD_PATH = normalizePrivateRoute(
  import.meta.env.VITE_ADMIN_DASHBOARD_PATH,
  '/cx-owner-control-72939'
);

export const DELIVERY_DASHBOARD_PATH = normalizePrivateRoute(
  import.meta.env.VITE_DELIVERY_DASHBOARD_PATH,
  '/cx-rider-live-72939'
);

export function adminPath(child = '') {
  const cleanChild = child.replace(/^\/+/, '').replace(/\/+$/, '');
  return cleanChild ? `${ADMIN_DASHBOARD_PATH}/${cleanChild}` : ADMIN_DASHBOARD_PATH;
}

export function isAdminDashboardPath(pathname: string) {
  return pathname === ADMIN_DASHBOARD_PATH || pathname.startsWith(`${ADMIN_DASHBOARD_PATH}/`);
}

export function isDeliveryDashboardPath(pathname: string) {
  return pathname === DELIVERY_DASHBOARD_PATH || pathname.startsWith(`${DELIVERY_DASHBOARD_PATH}/`);
}
