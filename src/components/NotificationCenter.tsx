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
    const masterGain = context.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(context.destination);

    // Loud repeated alarm pattern for urgent order / delivery assignment alerts.
    // Browsers still control the device's physical speaker volume, but this uses
    // maximum web-audio gain and a sharp square-wave siren pattern.
    const frequencies = [1040, 1560, 1040, 1560, 1240, 1760, 1240, 1760];
    for (let burst = 0; burst < 3; burst += 1) {
      frequencies.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const startAt = context.currentTime + burst * 2.1 + index * 0.22;
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(1.0, startAt + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.19);
        oscillator.connect(gain);
        gain.connect(masterGain);
        oscillator.start(startAt);
        oscillator.stop(startAt + 0.2);
      });
    }

    setTimeout(() => {
      context.close().catch(() => {});
    }, 7000);
  } catch {
    // Browsers can block audio until the user has interacted with the page.
  }
}

function canReceiveRoleAlert(profile: { is_admin?: boolean; role?: string | null } | null | undefined) {
  return Boolean(profile?.is_admin || profile?.role === 'delivery');
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
      if (canReceiveRoleAlert(profile)) {
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
    const intervalMs = canReceiveRoleAlert(profile) ? 1000 : 15000;
    const timer = window.setInterval(loadNotifications, intervalMs);
    const onFocus = () => loadNotifications();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id, profile?.is_admin, profile?.role]);

  useEffect(() => {
    if (!canReceiveRoleAlert(profile) || !('Notification' in window) || Notification.permission !== 'default') return;
    const requestPermission = () => {
      Notification.requestPermission().catch(() => {});
      window.removeEventListener('pointerdown', requestPermission);
      window.removeEventListener('keydown', requestPermission);
      window.removeEventListener('touchstart', requestPermission);
    };
    window.addEventListener('pointerdown', requestPermission, { once: true });
    window.addEventListener('keydown', requestPermission, { once: true });
    window.addEventListener('touchstart', requestPermission, { once: true });
    return () => {
      window.removeEventListener('pointerdown', requestPermission);
      window.removeEventListener('keydown', requestPermission);
      window.removeEventListener('touchstart', requestPermission);
    };
  }, [profile?.is_admin, profile?.role]);

  useEffect(() => {
    const newUrgent = urgentUnread.filter((item) => !lastBuzzIds.current.has(item.id));
    const now = Date.now();
    const shouldRepeatBuzz = urgentUnread.length > 0 && now - lastRepeatingBuzzAt.current >= 30000;
    if (!newUrgent.length && !shouldRepeatBuzz) return;

    newUrgent.forEach((item) => lastBuzzIds.current.add(item.id));
    lastRepeatingBuzzAt.current = now;
    playAlarm();
    if ('vibrate' in navigator) navigator.vibrate?.([650, 180, 650, 180, 650, 180, 650]);

    if ('Notification' in window && Notification.permission === 'granted' && newUrgent.length) {
      newUrgent.slice(0, 3).forEach((item) => new Notification(item.title, { body: item.message, requireInteraction: true }));
    }
  }, [urgentUnread]);

  return null;
}
