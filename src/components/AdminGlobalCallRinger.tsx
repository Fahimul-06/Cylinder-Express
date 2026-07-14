import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, PhoneCall, X } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { createAdminSocket, getCallConfig, type LiveCall, type RingConfig } from '../lib/callClient';
import { adminUrl } from '../lib/adminPath';

const DEFAULT_RING_CONFIG: RingConfig = {
  enabled: true,
  volume: 1,
  frequency: 950,
  intervalMs: 1200,
  beepMs: 700,
  vibrationEnabled: true,
};

type AdminGlobalCallRingerProps = {
  onOpenCalls: () => void;
  activeSection?: string;
};

export function AdminGlobalCallRinger({ onOpenCalls, activeSection }: AdminGlobalCallRingerProps) {
  const [incomingCalls, setIncomingCalls] = useState<LiveCall[]>([]);
  const [ringConfig, setRingConfig] = useState<RingConfig>(DEFAULT_RING_CONFIG);
  const [autoOpenIncomingPage, setAutoOpenIncomingPage] = useState(true);
  const [soundReady, setSoundReady] = useState(false);
  const [dismissedCallIds, setDismissedCallIds] = useState<Set<string>>(() => new Set());

  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringTimerRef = useRef<number | null>(null);
  const vibrationTimerRef = useRef<number | null>(null);
  const lastNotificationCallIdRef = useRef('');
  const lastAutoOpenedCallIdRef = useRef('');
  const ringConfigRef = useRef<RingConfig>(DEFAULT_RING_CONFIG);
  const soundReadyRef = useRef(false);

  const visibleCalls = incomingCalls.filter((call) => !dismissedCallIds.has(call.callId));
  const latestCall = visibleCalls[0];
  const shouldRing = visibleCalls.length > 0 && activeSection !== 'calls';

  const stopRinging = useCallback(() => {
    if (ringTimerRef.current) {
      window.clearInterval(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    if (vibrationTimerRef.current) {
      window.clearInterval(vibrationTimerRef.current);
      vibrationTimerRef.current = null;
    }
    if ('vibrate' in navigator) navigator.vibrate(0);
  }, []);

  const unlockSound = useCallback(async () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return false;

      const context = audioContextRef.current || new AudioContextCtor();
      audioContextRef.current = context;
      await context.resume();

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0.001;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.05);

      soundReadyRef.current = true;
      setSoundReady(true);
      localStorage.setItem('admin_call_sound_ready', 'true');
      return true;
    } catch {
      return false;
    }
  }, []);

  const playRingBeep = useCallback(async () => {
    const config = ringConfigRef.current;
    if (!config.enabled) return;

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      const context = audioContextRef.current || new AudioContextCtor();
      audioContextRef.current = context;
      await context.resume();
      soundReadyRef.current = true;
      setSoundReady(true);

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = config.frequency || DEFAULT_RING_CONFIG.frequency;
      gain.gain.value = Math.max(0, Math.min(1, config.volume ?? 1));
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + Math.max(100, config.beepMs || DEFAULT_RING_CONFIG.beepMs) / 1000);
    } catch {
      soundReadyRef.current = false;
      setSoundReady(false);
    }
  }, []);

  const showNotification = useCallback((call: LiveCall) => {
    if (lastNotificationCallIdRef.current === call.callId) return;
    lastNotificationCallIdRef.current = call.callId;

    const title = 'Incoming live customer call';
    const body = `${call.customerName || 'Website visitor'} is calling now. Tap to open Live Calls.`;

    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      navigator.serviceWorker.ready
        .then((registration) => registration.showNotification(title, {
          body,
          tag: `live-call-${call.callId}`,
          requireInteraction: true,
          icon: '/vite.svg',
          badge: '/vite.svg',
          data: { url: adminUrl('calls'), callId: call.callId },
        } as NotificationOptions))
        .catch(() => {});
      return;
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, { body, tag: `live-call-${call.callId}`, requireInteraction: true });
      notification.onclick = () => {
        window.focus();
        onOpenCalls();
        notification.close();
      };
    }
  }, [onOpenCalls]);

  const requestNotifications = useCallback(async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        // Browser may block permission prompts without a user gesture.
      }
    }
  }, []);

  const startRinging = useCallback(() => {
    const config = ringConfigRef.current;
    if (!config.enabled || ringTimerRef.current) return;

    void playRingBeep();
    ringTimerRef.current = window.setInterval(() => {
      void playRingBeep();
    }, Math.max(300, config.intervalMs || DEFAULT_RING_CONFIG.intervalMs));

    if (config.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate([700, 250, 700, 250, 700]);
      vibrationTimerRef.current = window.setInterval(() => {
        navigator.vibrate([700, 250, 700, 250, 700]);
      }, 2200);
    }
  }, [playRingBeep]);

  useEffect(() => {
    ringConfigRef.current = ringConfig;
  }, [ringConfig]);

  useEffect(() => {
    getCallConfig()
      .then((config) => {
        if (config.ring) setRingConfig({ ...DEFAULT_RING_CONFIG, ...config.ring });
        setAutoOpenIncomingPage(config.adminApp?.autoOpenIncomingPage !== false);
      })
      .catch(() => setRingConfig(DEFAULT_RING_CONFIG));
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/admin-call-sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    const autoPrepare = () => {
      void unlockSound();
      void requestNotifications();
      window.removeEventListener('pointerdown', autoPrepare);
      window.removeEventListener('keydown', autoPrepare);
    };

    void unlockSound();
    void requestNotifications();
    window.addEventListener('pointerdown', autoPrepare, { once: true });
    window.addEventListener('keydown', autoPrepare, { once: true });

    return () => {
      window.removeEventListener('pointerdown', autoPrepare);
      window.removeEventListener('keydown', autoPrepare);
    };
  }, [requestNotifications, unlockSound]);

  useEffect(() => {
    const socket = createAdminSocket();
    socketRef.current = socket;

    socket.on('admin:calls', (calls: LiveCall[]) => {
      setIncomingCalls(calls.filter((call) => call.status === 'ringing'));
    });

    socket.on('admin:incoming-call', (call: LiveCall) => {
      setIncomingCalls((current) => (current.some((item) => item.callId === call.callId) ? current : [call, ...current]));
      showNotification(call);

      if (autoOpenIncomingPage && lastAutoOpenedCallIdRef.current !== call.callId) {
        lastAutoOpenedCallIdRef.current = call.callId;
        localStorage.setItem('admin_pending_incoming_call_id', call.callId);

        if (document.visibilityState === 'visible') {
          onOpenCalls();
        }
      }
    });

    socket.on('call:ended', ({ callId }: { callId?: string } = {}) => {
      if (callId) setIncomingCalls((current) => current.filter((call) => call.callId !== callId));
    });

    return () => {
      stopRinging();
      socket.disconnect();
    };
  }, [autoOpenIncomingPage, onOpenCalls, showNotification, stopRinging]);

  useEffect(() => {
    if (shouldRing) {
      startRinging();
      if (latestCall) showNotification(latestCall);
    } else {
      stopRinging();
    }
  }, [latestCall, shouldRing, showNotification, startRinging, stopRinging]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!autoOpenIncomingPage || document.visibilityState !== 'visible') return;
      const pendingCallId = localStorage.getItem('admin_pending_incoming_call_id');
      if (pendingCallId && incomingCalls.some((call) => call.callId === pendingCallId)) {
        localStorage.removeItem('admin_pending_incoming_call_id');
        onOpenCalls();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [autoOpenIncomingPage, incomingCalls, onOpenCalls]);

  const openCalls = async () => {
    await unlockSound();
    await requestNotifications();
    onOpenCalls();
  };

  const dismiss = () => {
    if (!latestCall) return;
    setDismissedCallIds((current) => new Set(current).add(latestCall.callId));
    stopRinging();
  };

  if (!latestCall || activeSection === 'calls') return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-xl rounded-2xl border border-amber-400/50 bg-slate-950/95 p-4 shadow-2xl shadow-amber-500/20 backdrop-blur md:left-auto md:right-6 md:max-w-md">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-amber-400/20 p-3 text-amber-300">
          <BellRing className="animate-pulse" size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-300">Incoming live call</p>
          <h3 className="truncate text-lg font-bold text-gray-100">{latestCall.customerName}</h3>
          {latestCall.customerEmail && <p className="truncate text-sm text-gray-400">{latestCall.customerEmail}</p>}
          <p className="mt-1 text-xs text-gray-500">
            {soundReady ? 'Auto loud ring and incoming-page open are active.' : 'Tap anywhere once if your phone blocks auto sound.'}
          </p>
        </div>
        <button type="button" onClick={dismiss} className="rounded-lg p-2 text-gray-400 hover:bg-slate-800 hover:text-gray-100" aria-label="Dismiss call alert">
          <X size={18} />
        </button>
      </div>
      <button
        type="button"
        onClick={openCalls}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-orange-500 px-4 py-3 font-bold text-slate-950 hover:shadow-lg hover:shadow-amber-500/30"
      >
        <PhoneCall size={18} />
        Open Live Calls to Accept
      </button>
    </div>
  );
}
