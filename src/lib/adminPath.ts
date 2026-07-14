declare global {
  interface Window {
    __APP_CONFIG__?: {
      adminPath?: string;
    };
  }
}

function normalizeAdminPath(value?: string) {
  const fallback = '/secure-admin-dashboard';
  const raw = (value || fallback).trim();
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const cleaned = withSlash.replace(/\/+/g, '/').replace(/\/$/, '');
  return cleaned || fallback;
}

export const ADMIN_PATH = normalizeAdminPath(
  typeof window !== 'undefined'
    ? window.__APP_CONFIG__?.adminPath || import.meta.env.VITE_ADMIN_PATH
    : import.meta.env.VITE_ADMIN_PATH,
);

export function isAdminPath(pathname = window.location.pathname) {
  return pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`);
}

export function isLegacyAdminPath(pathname = window.location.pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function adminUrl(section?: string) {
  if (!section) return ADMIN_PATH;
  return `${ADMIN_PATH}?section=${encodeURIComponent(section)}`;
}
