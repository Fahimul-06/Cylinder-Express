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

let sharedAudioContext: AudioContext | null = null;

function getAudioContext() {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') sharedAudioContext = new AudioContextClass();
  if (sharedAudioContext.state === 'suspended') sharedAudioContext.resume().catch(() => {});
  return sharedAudioContext;
}

function unlockAlarmAudio() {
  try {
    const context = getAudioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = 0.0001;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.03);
  } catch {
    // Browser can still block audio until the page receives a user gesture.
  }
}

function playAlarm() {
  try {
    const context = getAudioContext();
    if (!context) return;
    const masterGain = context.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(context.destination);

    const pattern = [980, 1318, 1568, 1318, 980, 740, 980, 1568];
    for (let cycle = 0; cycle < 4; cycle += 1) {
      pattern.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + cycle * 1.65 + index * 0.18;
        oscillator.type = index % 2 === 0 ? 'square' : 'sawtooth';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.98, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
        oscillator.connect(gain);
        gain.connect(masterGain);
        oscillator.start(start);
        oscillator.stop(start + 0.16);
      });
    }
  } catch {
    // Browsers can block audio until the user has interacted with the page.
  }
}

export default function NotificationCenter() {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const lastBuzzIds = useRef(new Set<string>());
  const lastRepeatingBuzzAt = useRef(0);
  const notificationPermissionAsked = useRef(false);

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
    const intervalMs = profile?.is_admin || profile?.role === 'delivery' ? 1000 : 15000;
    const timer = window.setInterval(loadNotifications, intervalMs);
    const onFocus = () => loadNotifications();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id, profile?.is_admin, profile?.role]);

  useEffect(() => {
    if ((profile?.is_admin || profile?.role === 'delivery') && !notificationPermissionAsked.current && 'Notification' in window && Notification.permission === 'default') {
      notificationPermissionAsked.current = true;
      Notification.requestPermission().catch(() => {});
    }

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

  useEffect(() => {
    const unlock = () => unlockAlarmAudio();
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return null;
}
