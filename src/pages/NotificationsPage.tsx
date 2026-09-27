import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, Volume2, ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { getNotificationTargetPath } from '../lib/notificationRoutes';
import { getNotificationCache, setNotificationCache, updateNotificationCacheReadState } from '../lib/notificationCache';

type NotificationItem = {
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

type NotificationResponse = {
  data: NotificationItem[];
  unread_count: number | null;
  has_more?: boolean;
  next_before?: string | null;
  error: string | null;
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, profile } = useAuth();
  const initialCache = getNotificationCache(user?.id);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialCache?.data || []);
  const [unreadCount, setUnreadCount] = useState(initialCache?.unreadCount || 0);
  const [loading, setLoading] = useState(!initialCache?.data?.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [error, setError] = useState('');

  const urgentUnread = useMemo(
    () => notifications.filter((item) => !item.is_read && (item.urgent || item.buzz)),
    [notifications]
  );

  async function loadNotifications(silent = false) {
    if (!user) return;
    try {
      if (!silent && notifications.length === 0) setLoading(true);
      setError('');
      const response = await apiClient<NotificationResponse>('/api/notifications?limit=20');
      const next = response.data || [];
      setNotifications(next);
      if (response.unread_count !== null) setUnreadCount(response.unread_count || 0);
      setHasMore(Boolean(response.has_more));
      setNextBefore(response.next_before || null);
      setNotificationCache(user.id, next, response.unread_count ?? unreadCount);
    } catch (err) {
      if (notifications.length === 0) setError(err instanceof Error ? err.message : t('notifications.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function loadOlder() {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await apiClient<NotificationResponse>(`/api/notifications?limit=20&before=${encodeURIComponent(nextBefore)}`);
      const older = response.data || [];
      setNotifications((current) => {
        const ids = new Set(current.map((item) => item.id));
        return [...current, ...older.filter((item) => !ids.has(item.id))];
      });
      setHasMore(Boolean(response.has_more));
      setNextBefore(response.next_before || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notifications.loadFailed'));
    } finally {
      setLoadingMore(false);
    }
  }

  async function markAllRead() {
    if (!user) return;
    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true, buzz: false })));
    setUnreadCount(0);
    updateNotificationCacheReadState(user.id);
    try {
      await apiClient('/api/notifications/read', { method: 'POST', body: JSON.stringify({}) });
    } catch {
      loadNotifications(true);
    }
  }

  async function openNotification(item: NotificationItem) {
    const targetPath = getNotificationTargetPath(item, profile);
    if (!item.is_read && user) {
      setNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, is_read: true, buzz: false } : notification));
      setUnreadCount((count) => Math.max(0, count - 1));
      updateNotificationCacheReadState(user.id, [item.id]);
      apiClient('/api/notifications/read', { method: 'POST', body: JSON.stringify({ ids: [item.id] }) }).catch(() => {});
    }
    navigate(targetPath);
  }

  useEffect(() => {
    if (!user) return;
    const cached = getNotificationCache(user.id);
    if (cached?.data?.length) {
      setNotifications(cached.data);
      setUnreadCount(cached.unreadCount);
      setLoading(false);
    }
    loadNotifications(Boolean(cached?.data?.length));
    const intervalMs = profile?.is_admin || profile?.role === 'delivery' ? 5000 : 15000;
    const timer = window.setInterval(() => loadNotifications(true), intervalMs);
    return () => window.clearInterval(timer);
  }, [user?.id, profile?.is_admin, profile?.role]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate(-1)}
          className="mb-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </button>

        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Bell className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('notifications.title')}</h1>
                <p className="text-sm text-gray-500">
                  {unreadCount > 0
                    ? t('notifications.unreadCount').replace('{count}', String(unreadCount))
                    : t('notifications.noUnread')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {'Notification' in window && Notification.permission === 'default' && (
                <button
                  onClick={() => Notification.requestPermission().catch(() => {})}
                  className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50"
                >
                  {t('notifications.enableBrowser')}
                </button>
              )}
              <button
                onClick={markAllRead}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"
              >
                <CheckCheck className="h-4 w-4" />
                {t('notifications.markAllRead')}
              </button>
            </div>
          </div>
        </div>

        {urgentUnread.length > 0 && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <Volume2 className="mt-0.5 h-5 w-5 text-red-600" />
              <div>
                <p className="font-bold text-red-800">{t('notifications.urgentAlert')}</p>
                <p className="text-sm text-red-700">{urgentUnread[0].message}</p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-center text-gray-500">{t('loading')}</div>
        ) : error && notifications.length === 0 ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center">
            <Bell className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-semibold text-gray-700">{t('notifications.empty')}</p>
            <p className="mt-1 text-sm text-gray-500">{t('notifications.emptyText')}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className={`w-full rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    item.is_read
                      ? 'border-gray-100 bg-white'
                      : item.urgent
                        ? 'border-red-200 bg-red-50'
                        : 'border-blue-100 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold ${item.urgent ? 'text-red-800' : 'text-gray-900'}`}>{item.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-gray-700">{item.message}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!item.is_read && (
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          {t('notifications.new')}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">{new Date(item.created_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
            {hasMore && nextBefore && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={loadOlder}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loadingMore ? 'Loading…' : 'Load older notifications'}
                </button>
              </div>
            )}
            {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
