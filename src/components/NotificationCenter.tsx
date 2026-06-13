import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, Volume2, X } from 'lucide-react';
import { apiClient } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
  unread_count: number;
  error: string | null;
};

function playAlarm() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      context.close().catch(() => {});
    }, 450);
  } catch {
    // Browsers can block audio until the user has interacted with the page.
  }
}

export default function NotificationCenter() {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const lastBuzzIds = useRef(new Set<string>());

  const urgentUnread = useMemo(
    () => notifications.filter((item) => !item.is_read && (item.urgent || item.buzz)),
    [notifications]
  );

  async function loadNotifications() {
    if (!user) return;
    try {
      // Admin users also trigger the backend reminder checker when they are online.
      if (profile?.is_admin) {
        apiClient('/api/alerts/run', { method: 'POST', body: JSON.stringify({}) }).catch(() => {});
      }
      const response = await apiClient<NotificationResponse>('/api/notifications');
      setNotifications(response.data || []);
      setUnreadCount(response.unread_count || 0);
    } catch {
      // Keep notification polling silent; main app should not break because alerts fail.
    }
  }

  async function markAllRead() {
    await apiClient('/api/notifications/read', { method: 'POST', body: JSON.stringify({}) });
    await loadNotifications();
  }

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [user?.id, profile?.is_admin]);

  useEffect(() => {
    const newUrgent = urgentUnread.filter((item) => !lastBuzzIds.current.has(item.id));
    if (!newUrgent.length) return;
    newUrgent.forEach((item) => lastBuzzIds.current.add(item.id));
    playAlarm();
    if ('vibrate' in navigator) navigator.vibrate?.([250, 120, 250]);

    if ('Notification' in window && Notification.permission === 'granted') {
      newUrgent.slice(0, 3).forEach((item) => new Notification(item.title, { body: item.message }));
    }
  }, [urgentUnread]);

  if (!user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[1000]">
      {urgentUnread.length > 0 && !open && (
        <div className="mb-3 max-w-sm rounded-2xl border border-red-200 bg-red-50 p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <Volume2 className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-bold text-red-800">Urgent alert</p>
              <p className="text-xs text-red-700">{urgentUnread[0].message}</p>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="mb-3 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <div>
              <h3 className="font-bold text-gray-900">Notifications</h3>
              <p className="text-xs text-gray-500">Order, delivery and admin alerts</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto p-3">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No notifications yet.</p>
            ) : notifications.map((item) => (
              <div
                key={item.id}
                className={`mb-2 rounded-xl border p-3 ${item.is_read ? 'border-gray-100 bg-gray-50' : item.urgent ? 'border-red-200 bg-red-50' : 'border-blue-100 bg-blue-50'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-bold ${item.urgent ? 'text-red-800' : 'text-gray-900'}`}>{item.title}</p>
                  {!item.is_read && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">NEW</span>}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-gray-700">{item.message}</p>
                <p className="mt-2 text-[10px] text-gray-400">{new Date(item.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 p-3">
            {'Notification' in window && Notification.permission === 'default' && (
              <button
                onClick={() => Notification.requestPermission().catch(() => {})}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Enable browser alerts
              </button>
            )}
            <button
              onClick={markAllRead}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-800"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
        className={`relative flex h-13 w-13 items-center justify-center rounded-full shadow-lg transition ${urgentUnread.length ? 'bg-red-600 text-white animate-pulse' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        aria-label="Open notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-yellow-400 px-1.5 text-xs font-black text-gray-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
