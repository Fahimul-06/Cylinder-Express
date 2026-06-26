import { useEffect, useMemo, useRef, useState } from 'react';
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

const REPEATING_BUZZ_TYPES = new Set([
  'delivery_accept_overdue',
  'delivery_not_delivered_20m_admin',
  'admin_order_confirm_overdue',
]);

function playAlarm() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const masterGain = context.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(context.destination);

    // Strong repeated alert pattern for noisy delivery environments.
    // Browser volume is still controlled by the device/system volume.
    const frequencies = [1046, 1396, 1046, 1568, 1175, 1568, 1396, 1046, 880, 1320, 880, 1320];
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.18);
      gain.gain.exponentialRampToValueAtTime(1.0, context.currentTime + index * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.18 + 0.15);
      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start(context.currentTime + index * 0.18);
      oscillator.stop(context.currentTime + index * 0.18 + 0.16);
    });

    setTimeout(() => {
      context.close().catch(() => {});
    }, 2600);
  } catch {
    // Browsers can block audio until the user has interacted with the page.
  }
}

export default function NotificationCenter() {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const lastBuzzIds = useRef(new Set<string>());
  const lastRepeatingBuzzAt = useRef(0);

  const urgentUnread = useMemo(
    () => notifications.filter((item) => !item.is_read && (item.urgent || item.buzz)),
    [notifications]
  );

  async function loadNotifications() {
    if (!user) return;
    try {
      if (profile?.is_admin || profile?.role === 'delivery') {
        apiClient('/api/alerts/run', { method: 'POST', body: JSON.stringify({}) }).catch(() => {});
      }
      const response = await apiClient<NotificationResponse>('/api/notifications');
      setNotifications(response.data || []);
    } catch {
      // Keep notification polling silent; main app should not break because alerts fail.
    }
  }

  useEffect(() => {
    loadNotifications();
    const intervalMs = profile?.is_admin || profile?.role === 'delivery' ? 2000 : 15000;
    const timer = window.setInterval(loadNotifications, intervalMs);
    const onFocus = () => loadNotifications();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id, profile?.is_admin, profile?.role]);

  useEffect(() => {
    const newUrgent = urgentUnread.filter((item) => !lastBuzzIds.current.has(item.id));
    const repeatingUrgent = urgentUnread.filter((item) => REPEATING_BUZZ_TYPES.has(item.type));
    const now = Date.now();
    const shouldRepeatBuzz = repeatingUrgent.length > 0 && now - lastRepeatingBuzzAt.current >= 30000;
    if (!newUrgent.length && !shouldRepeatBuzz) return;

    newUrgent.forEach((item) => lastBuzzIds.current.add(item.id));
    lastRepeatingBuzzAt.current = now;
    playAlarm();
    if ('vibrate' in navigator) navigator.vibrate?.([900, 180, 900, 180, 900, 180, 900]);

    if ('Notification' in window && Notification.permission === 'granted' && newUrgent.length) {
      newUrgent.slice(0, 3).forEach((item) => new Notification(item.title, { body: item.message, requireInteraction: true }));
    }
  }, [urgentUnread]);

  return null;
}
