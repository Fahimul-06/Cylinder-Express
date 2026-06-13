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
  const lastBuzzIds = useRef(new Set<string>());

  const urgentUnread = useMemo(
    () => notifications.filter((item) => !item.is_read && (item.urgent || item.buzz)),
    [notifications]
  );

  async function loadNotifications() {
    if (!user) return;
    try {
      if (profile?.is_admin) {
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

  return null;
}
