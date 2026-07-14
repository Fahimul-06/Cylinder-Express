import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellRing, Check, Copy, Headphones, Link, Loader2, MapPin, Mic, MicOff, Phone, PhoneOff, RefreshCw, Send, Share2, Smartphone, Trash2, Volume2, WifiOff } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { createAdminSocket, deleteCallHistoryItem, getCallConfig, getCallHistory, sendAdminSms, type CallHistoryItem, type LiveCall, type RingConfig } from '../lib/callClient';

type ManagerStatus = 'connecting' | 'ready' | 'in-call' | 'error';

const DEFAULT_RING_CONFIG: RingConfig = {
  enabled: true,
  volume: 1,
  frequency: 950,
  intervalMs: 1200,
  beepMs: 700,
  vibrationEnabled: true,
};

export function LiveCallManager() {
  const [status, setStatus] = useState<ManagerStatus>('connecting');
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [activeCall, setActiveCall] = useState<LiveCall | null>(null);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [ringConfig, setRingConfig] = useState<RingConfig>(DEFAULT_RING_CONFIG);
  const [shareCopied, setShareCopied] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('Please open this link to call me live: {{CALL_URL}}');
  const [smsIncludeCallUrl, setSmsIncludeCallUrl] = useState(true);
  const [smsSending, setSmsSending] = useState(false);
  const [smsStatus, setSmsStatus] = useState('');
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeCallIdRef = useRef('');
  const iceServersRef = useRef<RTCIceServer[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringTimerRef = useRef<number | null>(null);
  const vibrationTimerRef = useRef<number | null>(null);
  const soundUnlockedRef = useRef(false);
  const ringConfigRef = useRef<RingConfig>(DEFAULT_RING_CONFIG);


  const callUrl = `${window.location.origin}/call`;

  const formatLocation = (location?: CallHistoryItem['ip_location'] | LiveCall['ipLocation']) => {
    if (!location) return 'Location unavailable';
    return [location.city, location.region, location.country].filter(Boolean).join(', ') || 'Location unavailable';
  };

  const formatDevice = (device?: CallHistoryItem['device'] | LiveCall['device'] | null) => {
    if (!device) return 'Unknown device';
    return [device.vendor, device.model, device.type, device.browser, device.os].filter(Boolean).join(' · ') || 'Unknown device';
  };

  const formatDuration = (seconds = 0) => {
    const total = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
  };

  const loadCallHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError('');
      setCallHistory(await getCallHistory(150));
    } catch (historyLoadError) {
      setHistoryError(historyLoadError instanceof Error ? historyLoadError.message : 'Could not load call history.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const removeHistoryItem = async (id: string) => {
    try {
      await deleteCallHistoryItem(id);
      setCallHistory((current) => current.filter((item) => item.id !== id));
    } catch (deleteError) {
      setHistoryError(deleteError instanceof Error ? deleteError.message : 'Could not delete call history.');
    }
  };

  const copyCallIp = async (ip = '') => {
    if (!ip) return;
    try {
      await navigator.clipboard.writeText(ip);
    } catch {
      setError('Could not copy caller IP.');
    }
  };

  const copyCallUrl = async () => {
    try {
      await navigator.clipboard.writeText(callUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2500);
    } catch {
      setError('Could not copy call URL. Select and copy it manually.');
    }
  };

  const shareCallUrl = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Start a live call',
          text: 'Open this link to call me directly from your phone browser.',
          url: callUrl,
        });
      } else {
        await copyCallUrl();
      }
    } catch {
      // User cancelled the share sheet or the browser blocked it.
    }
  };

  const sendCallSms = async () => {
    try {
      setSmsSending(true);
      setSmsStatus('');
      setError('');
      const result = await sendAdminSms(smsPhone, smsMessage, smsIncludeCallUrl);
      const gatewayText = result.providerCode ? ` Gateway code: ${result.providerCode}.` : '';
      setSmsStatus(result.callUrl ? `SMS accepted by BulkSMSBD for ${result.number}.${gatewayText} Call URL: ${result.callUrl}` : `SMS accepted by BulkSMSBD for ${result.number}.${gatewayText}`);
    } catch (smsError) {
      setSmsStatus('');
      setError(smsError instanceof Error ? smsError.message : 'Could not send call SMS.');
    } finally {
      setSmsSending(false);
    }
  };

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
    setRinging(false);
  }, []);

  const playRingBeep = useCallback(async () => {
    const config = ringConfigRef.current;
    if (!config.enabled || !soundUnlockedRef.current) return;

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = audioContextRef.current || new AudioContextCtor();
    audioContextRef.current = context;
    await context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = config.frequency || DEFAULT_RING_CONFIG.frequency;
    gain.gain.value = Math.max(0, Math.min(1, config.volume ?? 1));
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + Math.max(100, config.beepMs || DEFAULT_RING_CONFIG.beepMs) / 1000);
  }, []);

  const startRinging = useCallback(() => {
    const config = ringConfigRef.current;
    if (!config.enabled || ringTimerRef.current) return;

    setRinging(true);
    void playRingBeep();
    ringTimerRef.current = window.setInterval(() => {
      void playRingBeep();
    }, Math.max(300, config.intervalMs || DEFAULT_RING_CONFIG.intervalMs));

    if (config.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate([600, 250, 600]);
      vibrationTimerRef.current = window.setInterval(() => {
        navigator.vibrate([600, 250, 600]);
      }, 1800);
    }
  }, [playRingBeep]);

  const unlockRingSound = async () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) throw new Error('This browser does not support Web Audio.');

      const context = audioContextRef.current || new AudioContextCtor();
      audioContextRef.current = context;
      await context.resume();

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0.001;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.08);

      soundUnlockedRef.current = true;
      setSoundUnlocked(true);
      setError('');

      if (calls.length > 0 && !activeCall) startRinging();
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : 'Could not enable loud ring sound.');
    }
  };

  useEffect(() => {
    ringConfigRef.current = ringConfig;
  }, [ringConfig]);

  useEffect(() => {
    void loadCallHistory();
  }, [loadCallHistory]);

  useEffect(() => {
    getCallConfig()
      .then((config) => {
        if (config.ring) setRingConfig({ ...DEFAULT_RING_CONFIG, ...config.ring });
      })
      .catch(() => {
        setRingConfig(DEFAULT_RING_CONFIG);
      });
  }, []);

  useEffect(() => {
    void unlockRingSound();

    const prepareSound = () => {
      void unlockRingSound();
      window.removeEventListener('pointerdown', prepareSound);
      window.removeEventListener('keydown', prepareSound);
    };

    window.addEventListener('pointerdown', prepareSound, { once: true });
    window.addEventListener('keydown', prepareSound, { once: true });

    return () => {
      window.removeEventListener('pointerdown', prepareSound);
      window.removeEventListener('keydown', prepareSound);
    };
  }, []);

  useEffect(() => {
    if (calls.length > 0 && !activeCall) startRinging();
    else stopRinging();
  }, [calls.length, activeCall, startRinging, stopRinging]);

  useEffect(() => {
    const socket = createAdminSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('ready');
      setError('');
    });

    socket.on('connect_error', (connectError) => {
      setStatus('error');
      setError(connectError.message || 'Could not connect to live call server.');
    });

    socket.on('admin:calls', (nextCalls: LiveCall[]) => {
      setCalls(nextCalls.filter((call) => call.status === 'ringing'));
    });

    socket.on('admin:incoming-call', (call: LiveCall) => {
      setCalls((current) => (current.some((item) => item.callId === call.callId) ? current : [call, ...current]));
    });

    socket.on('admin:call-history-updated', (item: CallHistoryItem) => {
      setCallHistory((current) => {
        const exists = current.some((entry) => entry.id === item.id);
        const next = exists ? current.map((entry) => (entry.id === item.id ? item : entry)) : [item, ...current];
        return next.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()).slice(0, 150);
      });
    });

    socket.on('webrtc:offer', async ({ callId, offer }) => {
      if (!peerRef.current || callId !== activeCallIdRef.current) return;
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      socket.emit('webrtc:answer', { callId, answer });
      setStatus('in-call');
    });

    socket.on('webrtc:ice-candidate', async ({ candidate }) => {
      if (peerRef.current && candidate) {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on('call:ended', () => {
      cleanupCall(false);
      stopRinging();
      setActiveCall(null);
      setStatus('ready');
    });

    return () => {
      cleanupCall(true);
      stopRinging();
      socket.disconnect();
    };
  }, [stopRinging]);

  const cleanupCall = (notify: boolean) => {
    const callId = activeCallIdRef.current;
    if (notify && socketRef.current?.connected && callId) {
      socketRef.current.emit('call:end', { callId });
    }

    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    activeCallIdRef.current = '';
    setMuted(false);
  };

  const createPeer = (socket: Socket, callId: string) => {
    const peer = new RTCPeerConnection({ iceServers: iceServersRef.current });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc:ice-candidate', { callId, candidate: event.candidate });
      }
    };

    peer.ontrack = (event) => {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0];
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') setStatus('in-call');
      if (['failed', 'closed', 'disconnected'].includes(peer.connectionState)) setStatus('ready');
    };

    localStreamRef.current?.getTracks().forEach((track) => {
      if (localStreamRef.current) peer.addTrack(track, localStreamRef.current);
    });

    peerRef.current = peer;
    return peer;
  };

  const acceptCall = async (call: LiveCall) => {
    try {
      stopRinging();
      setError('');
      setStatus('connecting');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      socketRef.current?.emit(
        'admin:accept-call',
        { callId: call.callId },
        (response: { ok: boolean; call?: LiveCall; iceServers?: RTCIceServer[]; message?: string }) => {
          if (!response.ok || !response.call) {
            cleanupCall(false);
            setStatus('ready');
            setError(response.message || 'Could not accept call.');
            return;
          }

          activeCallIdRef.current = call.callId;
          iceServersRef.current = response.iceServers || [];
          setActiveCall(response.call);
          setCalls((current) => current.filter((item) => item.callId !== call.callId));
          if (socketRef.current) createPeer(socketRef.current, call.callId);
        }
      );
    } catch (acceptError) {
      cleanupCall(false);
      setStatus('ready');
      setError(acceptError instanceof Error ? acceptError.message : 'Microphone permission failed.');
    }
  };

  const endCall = () => {
    cleanupCall(true);
    stopRinging();
    setActiveCall(null);
    setStatus('ready');
  };

  const rejectCall = (call: LiveCall) => {
    socketRef.current?.emit('call:end', { callId: call.callId });
    setCalls((current) => current.filter((item) => item.callId !== call.callId));
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Live Customer Calls</h1>
        <p className="text-gray-400">Receive browser audio calls from website visitors in real time.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          {error}
        </div>
      )}


      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-cyan-400/20 p-3 text-cyan-300">
              <Link size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-100">Send live-call URL to any phone</h2>
              <p className="text-sm text-cyan-100/80">
                Send this link by SMS, WhatsApp, Messenger, email, or any chat app. The receiver opens it and taps Start Live Call.
              </p>
              <input
                readOnly
                value={callUrl}
                onFocus={(event) => event.currentTarget.select()}
                className="mt-3 w-full rounded-xl border border-cyan-500/30 bg-slate-950/70 px-4 py-3 text-sm text-cyan-100 outline-none lg:min-w-[420px]"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[260px]">
            <button
              type="button"
              onClick={copyCallUrl}
              className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/40 px-5 py-3 font-bold text-cyan-100 hover:bg-cyan-500/10"
            >
              {shareCopied ? <Check size={18} /> : <Copy size={18} />}
              {shareCopied ? 'Copied' : 'Copy URL'}
            </button>
            <button
              type="button"
              onClick={shareCallUrl}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 font-bold text-slate-950 hover:shadow-lg hover:shadow-cyan-500/30"
            >
              <Share2 size={18} />
              Share
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-400/20 p-3 text-emerald-300">
            <Send size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-100">Admin SMS Center</h2>
            <p className="text-sm text-emerald-100/80">
              Send a live-call URL SMS or any custom SMS from the admin dashboard using your BulkSMSBD API key.
            </p>

            <div className="mt-4 grid gap-3 lg:grid-cols-[260px_1fr_auto]">
              <input
                value={smsPhone}
                onChange={(event) => setSmsPhone(event.target.value)}
                placeholder="01XXXXXXXXX or 8801XXXXXXXXX"
                className="rounded-xl border border-emerald-500/30 bg-slate-950/70 px-4 py-3 text-sm text-emerald-100 outline-none focus:border-emerald-300"
              />
              <textarea
                value={smsMessage}
                onChange={(event) => setSmsMessage(event.target.value)}
                rows={3}
                placeholder={smsIncludeCallUrl ? 'SMS text. Use {{CALL_URL}} or it will be added automatically.' : 'Write any SMS message here.'}
                className="rounded-xl border border-emerald-500/30 bg-slate-950/70 px-4 py-3 text-sm text-emerald-100 outline-none focus:border-emerald-300"
              />
              <button
                type="button"
                onClick={sendCallSms}
                disabled={smsSending || !smsPhone.trim() || !smsMessage.trim()}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-lg hover:shadow-emerald-500/30"
              >
                {smsSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                {smsSending ? 'Sending...' : 'Send SMS'}
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-slate-950/30 p-3 text-sm text-emerald-100/90 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={smsIncludeCallUrl}
                  onChange={(event) => setSmsIncludeCallUrl(event.target.checked)}
                  className="h-4 w-4 rounded border-emerald-500/40 bg-slate-900"
                />
                Include live-call URL in this SMS
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSmsIncludeCallUrl(true);
                    setSmsMessage('Please open this link to call me live: {{CALL_URL}}');
                  }}
                  className="rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-500/10"
                >
                  Call-link template
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSmsIncludeCallUrl(false);
                    setSmsMessage('Thank you for contacting us. We will get back to you soon.');
                  }}
                  className="rounded-lg border border-emerald-400/30 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-500/10"
                >
                  Normal SMS template
                </button>
              </div>
            </div>

            <p className="mt-2 text-xs text-emerald-200/70">
              For call-link SMS, use <span className="font-mono">{'{{CALL_URL}}'}</span> anywhere in the message, or enable the checkbox and the system will append the URL automatically.
            </p>
            {smsStatus && (
              <div className="mt-3 rounded-xl border border-green-400/30 bg-green-400/10 p-3 text-sm text-green-200">
                {smsStatus}
                <p className="mt-1 text-xs text-green-100/70">If the phone still does not receive it, check BulkSMSBD delivery report, balance, sender ID approval, and DND/operator filtering.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-400/20 p-3 text-amber-300">
              {ringing ? <BellRing className="animate-pulse" size={24} /> : <Bell size={24} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-100">Admin mobile loud ring</h2>
              <p className="text-sm text-amber-100/80">
                Auto loud ring starts when possible. Keep the admin dashboard open on your phone; if the browser blocks sound, tap once anywhere to unlock it.
              </p>
              <p className="mt-1 text-xs text-amber-200/70">
                Ring volume: {Math.round((ringConfig.volume ?? 1) * 100)}% · Frequency: {ringConfig.frequency}Hz · Vibration: {ringConfig.vibrationEnabled ? 'on' : 'off'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={unlockRingSound}
            className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold transition ${
              soundUnlocked
                ? 'bg-green-500 text-slate-950 hover:bg-green-400'
                : 'bg-gradient-to-r from-amber-300 to-orange-500 text-slate-950 hover:shadow-lg hover:shadow-amber-500/30'
            }`}
          >
            <Volume2 size={18} />
            {soundUnlocked ? 'Auto Loud Ring On' : 'Unlock Ring Sound'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-500/10 p-3 text-cyan-400">
              <Headphones size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-100">Call Status</h2>
              <p className="text-sm text-gray-400">
                {status === 'connecting' && 'Connecting to call server...'}
                {status === 'ready' && 'Ready for incoming calls'}
                {status === 'in-call' && 'Connected with customer'}
                {status === 'error' && 'Call server offline or unauthorized'}
              </p>
            </div>
          </div>
          {status === 'connecting' && <Loader2 className="animate-spin text-cyan-400" size={24} />}
          {status === 'error' && <WifiOff className="text-red-400" size={24} />}
        </div>

        {activeCall ? (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5">
            <p className="text-sm uppercase tracking-wide text-green-300">Active call</p>
            <h3 className="mt-1 text-2xl font-bold text-gray-100">{activeCall.customerName}</h3>
            {activeCall.customerEmail && <p className="text-gray-400">{activeCall.customerEmail}</p>}
            <div className="mt-4 grid gap-3 rounded-xl border border-green-500/20 bg-slate-950/30 p-4 text-sm text-green-100 sm:grid-cols-2">
              <p><span className="text-green-300">Caller IP:</span> {activeCall.ipAddress || 'Unknown'}</p>
              <p><span className="text-green-300">Device:</span> {formatDevice(activeCall.device)}</p>
              <p className="sm:col-span-2"><span className="text-green-300">Approx. location:</span> {formatLocation(activeCall.ipLocation)}</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={toggleMute}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-gray-100 hover:bg-slate-700"
              >
                {muted ? <MicOff size={18} /> : <Mic size={18} />}
                {muted ? 'Unmute Microphone' : 'Mute Microphone'}
              </button>
              <button
                type="button"
                onClick={endCall}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 font-semibold text-white hover:bg-red-600"
              >
                <PhoneOff size={18} />
                End Call
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {calls.length === 0 ? (
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-8 text-center text-gray-400">
                No incoming calls right now. Keep this page open on your phone to receive loud rings.
              </div>
            ) : (
              calls.map((call) => (
                <div key={call.callId} className="flex flex-col gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wide text-amber-300">Incoming call</p>
                    <h3 className="text-xl font-bold text-gray-100">{call.customerName}</h3>
                    {call.customerEmail && <p className="text-sm text-gray-400">{call.customerEmail}</p>}
                    <p className="mt-1 text-xs text-gray-500">Started {new Date(call.createdAt).toLocaleString()}</p>
                    <div className="mt-3 grid gap-2 rounded-xl border border-amber-500/20 bg-slate-950/30 p-3 text-xs text-amber-100 sm:grid-cols-2">
                      <p><span className="text-amber-300">IP:</span> {call.ipAddress || 'Unknown'}</p>
                      <p><span className="text-amber-300">Device:</span> {formatDevice(call.device)}</p>
                      <p className="sm:col-span-2"><span className="text-amber-300">Location:</span> {formatLocation(call.ipLocation)}</p>
                    </div>
                    {!soundUnlocked && <p className="mt-2 text-sm font-semibold text-amber-200">If your phone blocks automatic sound, tap once anywhere or press “Unlock Ring Sound”.</p>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => rejectCall(call)}
                      className="flex items-center justify-center gap-2 rounded-xl border border-red-500/40 px-5 py-3 font-bold text-red-300 hover:bg-red-500/10"
                    >
                      <PhoneOff size={18} />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => acceptCall(call)}
                      className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-400 to-emerald-600 px-5 py-3 font-bold text-slate-950 hover:shadow-lg hover:shadow-green-500/30"
                    >
                      <Phone size={18} />
                      Accept
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>


      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">Caller IP & Call History</h2>
            <p className="text-sm text-gray-400">See every caller IP, phone/browser, approximate IP location, status, and call duration.</p>
          </div>
          <button
            type="button"
            onClick={loadCallHistory}
            disabled={historyLoading}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-4 py-3 font-bold text-gray-100 hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw className={historyLoading ? 'animate-spin' : ''} size={18} />
            Refresh
          </button>
        </div>

        {historyError && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{historyError}</div>
        )}

        {callHistory.length === 0 ? (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-8 text-center text-gray-400">
            No call history yet. After a visitor starts a live call, caller details will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {callHistory.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-200">{item.status}</span>
                      <span className="text-sm text-gray-400">{new Date(item.started_at).toLocaleString()}</span>
                      {item.duration_seconds ? <span className="text-sm text-gray-500">Duration: {formatDuration(item.duration_seconds)}</span> : null}
                    </div>
                    <h3 className="text-lg font-bold text-gray-100">{item.customer_name || 'Website visitor'}</h3>
                    <div className="grid gap-2 text-sm text-gray-300 md:grid-cols-2">
                      <p className="flex items-center gap-2"><Phone size={15} className="text-emerald-300" /> {item.customer_phone || 'No phone from link'}</p>
                      <button type="button" onClick={() => copyCallIp(item.ip_address)} className="flex items-center gap-2 text-left text-cyan-200 hover:text-cyan-100"><Copy size={15} /> IP: {item.ip_address || 'Unknown'}</button>
                      <p className="flex items-center gap-2 md:col-span-2"><Smartphone size={15} className="text-amber-300" /> {formatDevice(item.device)}</p>
                      <p className="flex items-center gap-2 md:col-span-2"><MapPin size={15} className="text-pink-300" /> {formatLocation(item.ip_location)}{item.ip_location?.isp ? ` · ${item.ip_location.isp}` : ''}</p>
                    </div>
                    {item.end_reason && <p className="text-xs text-gray-500">Reason: {item.end_reason}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeHistoryItem(item.id)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-sm font-bold text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  );
}
