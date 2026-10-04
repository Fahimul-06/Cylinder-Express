export type CustomerSettings = {
  backgroundAlerts: boolean;
  notificationSound: boolean;
  vibration: boolean;
  offerPopups: boolean;
};

export const DEFAULT_CUSTOMER_SETTINGS: CustomerSettings = {
  backgroundAlerts: true,
  notificationSound: true,
  vibration: true,
  offerPopups: true,
};

const EVENT_NAME = 'cylinder-express-customer-settings';

function storageKey(userId?: string | null) {
  return `cylinder-express-customer-settings:${userId || 'guest'}`;
}

export function getCustomerSettings(userId?: string | null): CustomerSettings {
  if (typeof window === 'undefined') return DEFAULT_CUSTOMER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULT_CUSTOMER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<CustomerSettings>;
    return { ...DEFAULT_CUSTOMER_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_CUSTOMER_SETTINGS;
  }
}

export function saveCustomerSettings(userId: string | null | undefined, settings: CustomerSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(settings));
  } catch {
    // Settings still apply in the current component even if storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { userId: userId || 'guest', settings } }));
}

export function subscribeCustomerSettings(
  listener: (settings: CustomerSettings) => void,
  userId?: string | null,
) {
  if (typeof window === 'undefined') return () => {};
  const normalizedUserId = userId || 'guest';
  const handler = (event: Event) => {
    const custom = event as CustomEvent<{ userId: string; settings: CustomerSettings }>;
    if (custom.detail?.userId === normalizedUserId) listener(custom.detail.settings);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
