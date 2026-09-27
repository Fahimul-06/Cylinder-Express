export type CachedNotification = {
  id: string;
  user_id: string;
  order_id?: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  urgent?: boolean;
  buzz?: boolean;
  created_at: string;
};

type NotificationCacheValue = {
  userId: string;
  data: CachedNotification[];
  unreadCount: number;
  updatedAt: number;
};

const CACHE_PREFIX = 'cx_notification_cache_v2:';
const EVENT_NAME = 'cx-notification-cache-updated';

function key(userId: string) {
  return `${CACHE_PREFIX}${userId}`;
}

export function getNotificationCache(userId?: string | null): NotificationCacheValue | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NotificationCacheValue;
    if (!parsed || parsed.userId !== userId || !Array.isArray(parsed.data)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setNotificationCache(userId: string, data: CachedNotification[], unreadCount: number) {
  if (typeof window === 'undefined') return;
  const value: NotificationCacheValue = { userId, data, unreadCount, updatedAt: Date.now() };
  try {
    window.sessionStorage.setItem(key(userId), JSON.stringify(value));
  } catch {
    // Cache is an optimization only.
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: value }));
}

export function updateNotificationCacheReadState(userId: string, ids?: string[]) {
  const current = getNotificationCache(userId);
  if (!current) return;
  const idSet = ids?.length ? new Set(ids) : null;
  let changed = 0;
  const data = current.data.map((item) => {
    const shouldRead = !item.is_read && (!idSet || idSet.has(item.id));
    if (!shouldRead) return item;
    changed += 1;
    return { ...item, is_read: true, buzz: false };
  });
  setNotificationCache(userId, data, Math.max(0, current.unreadCount - changed));
}

export function subscribeNotificationCache(listener: (value: NotificationCacheValue) => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<NotificationCacheValue>).detail;
    if (detail) listener(detail);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
