const VISITOR_ID_KEY = 'portfolio_visitor_id';
import { getCachedGpsLocation, saveCachedGpsLocation } from './cookieConsent';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export type GpsPayload = {
  lat: number;
  lng: number;
  accuracy?: number | null;
};

function createVisitorId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getVisitorId() {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = createVisitorId();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

export function getPhoneFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('phone') || '';
}

function getDevicePayload() {
  return {
    screen: `${window.screen?.width || 0}x${window.screen?.height || 0}@${window.devicePixelRatio || 1}`,
    language: navigator.language || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    platform: navigator.platform || '',
  };
}

export async function trackVisitor(gps?: GpsPayload) {
  try {
    await fetch(`${API_BASE}/visitor/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: getVisitorId(),
        path: `${window.location.pathname}${window.location.search}`,
        referrer: document.referrer || '',
        userAgent: navigator.userAgent || '',
        phoneFromLink: getPhoneFromUrl(),
        device: getDevicePayload(),
        gps: gps || null,
        cachedGps: gps ? null : getCachedGpsLocation(),
      }),
    });
  } catch (error) {
    console.warn('Visitor tracking failed:', error);
  }
}

export function requestGpsLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });
  });
}

export async function requestAndTrackGpsLocation() {
  const position = await requestGpsLocation();
  const gps = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };
  saveCachedGpsLocation({ ...gps, capturedAt: new Date().toISOString() });
  await trackVisitor(gps);
  return position;
}

export async function trackWithCachedGpsIfAvailable() {
  const cached = getCachedGpsLocation();
  if (!cached) {
    await trackVisitor();
    return false;
  }

  await trackVisitor({
    lat: cached.lat,
    lng: cached.lng,
    accuracy: cached.accuracy,
  });
  return true;
}
