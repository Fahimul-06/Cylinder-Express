export const COOKIE_CONSENT_KEY = 'portfolio_cookie_location_consent';
export const GPS_CACHE_KEY = 'portfolio_last_gps_location';

export type CookieConsentStatus = 'accepted_all_location' | 'essential_only' | '';

export type CachedGpsLocation = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  capturedAt: string;
};

const ONE_YEAR_DAYS = 365;

export function setCookie(name: string, value: string, days = ONE_YEAR_DAYS) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getCookie(name: string) {
  const encodedName = `${encodeURIComponent(name)}=`;
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName))
    ?.slice(encodedName.length) || '';
}

export function getCookieConsentStatus(): CookieConsentStatus {
  const cookieStatus = decodeURIComponent(getCookie(COOKIE_CONSENT_KEY) || '') as CookieConsentStatus;
  if (cookieStatus) return cookieStatus;
  return (localStorage.getItem(COOKIE_CONSENT_KEY) || '') as CookieConsentStatus;
}

export function saveCookieConsentStatus(status: CookieConsentStatus) {
  setCookie(COOKIE_CONSENT_KEY, status);
  localStorage.setItem(COOKIE_CONSENT_KEY, status);
}

export function saveCachedGpsLocation(location: CachedGpsLocation) {
  const value = JSON.stringify(location);
  localStorage.setItem(GPS_CACHE_KEY, value);
  // Keep a short cookie copy too, because the user specifically asked for cookie-based location consent.
  // The browser permission is still required; this only stores the last approved location.
  setCookie(GPS_CACHE_KEY, value, 30);
}

export function getCachedGpsLocation(): CachedGpsLocation | null {
  const raw = localStorage.getItem(GPS_CACHE_KEY) || decodeURIComponent(getCookie(GPS_CACHE_KEY) || '');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedGpsLocation;
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}
