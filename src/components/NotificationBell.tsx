import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

type NotificationResponse = {
  unread_count: number;
};

export default function NotificationBell({ compact = false }: { compact?: boolean }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);

  async function loadUnread() {
    if (!user) return;
    try {
      const response = await apiClient<NotificationResponse>('/api/notifications');
      setUnreadCount(response.unread_count || 0);
    } catch {
      // Do not block navigation if notifications cannot be loaded.
    }
  }

  useEffect(() => {
    loadUnread();
    const intervalMs = profile?.is_admin || profile?.role === 'delivery' ? 1000 : 15000;
    const timer = window.setInterval(loadUnread, intervalMs);
    const onFocus = () => loadUnread();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id, profile?.is_admin, profile?.role]);

  if (!user) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/notifications')}
      className={`relative inline-flex items-center justify-center rounded-xl transition-all ${
        compact
          ? 'h-10 w-10 bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700'
          : 'h-10 px-3 gap-2 bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700'
      }`}
      aria-label={t('notifications.open')}
      title={t('notifications.title')}
    >
      <Bell className="h-4 w-4" />
      {!compact && <span className="text-sm font-semibold">{t('notifications.title')}</span>}
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
