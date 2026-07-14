import { useEffect, useRef, useState } from 'react';
import { PhoneCall, PhoneOff, Mic, MicOff, Loader2, X } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { createCustomerSocket, getCallConfig } from '../lib/callClient';

type CallStatus = 'idle' | 'connecting' | 'ringing' | 'active' | 'ended' | 'error';

type CustomerLiveCallProps = {
  defaultName?: string;
  defaultEmail?: string;
  initiallyOpen?: boolean;
  hideFloatingButton?: boolean;
  lockedOpen?: boolean;
  title?: string;
  description?: string;
};

export function CustomerLiveCall({
  defaultName = '',
  defaultEmail = '',
  initiallyOpen = false,
  hideFloatingButton = false,
  lockedOpen = false,
  title = 'Call me live',
  description = 'Start a browser audio call directly from this website.',
}: CustomerLiveCallProps) {
  const [open, setOpen] = useState(initiallyOpen || lockedOpen);
  const [customerName, setCustomerName] = useState(defaultName);
  const [customerEmail, setCustomerEmail] = useState(defaultEmail);
  const [status, setStatus] = useState<CallStatus>('idle');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callIdRef = useRef<string>('');
  const iceServersRef = useRef<RTCIceServer[]>([]);

  useEffect(() => {
    return () => cleanup(true);
  }, []);

  const cleanup = (notify = false) => {
    const callId = callIdRef.current;
    if (notify && socketRef.current?.connected && callId) {
      socketRef.current.emit('call:end', { callId });
    }

    peerRef.current?.close();
    peerRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    socketRef.current?.disconnect();
    socketRef.current = null;
    callIdRef.current = '';
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
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') setStatus('active');
      if (['failed', 'closed', 'disconnected'].includes(peer.connectionState)) {
        if (status !== 'ended') setStatus('ended');
      }
    };

    localStreamRef.current?.getTracks().forEach((track) => {
      if (localStreamRef.current) peer.addTrack(track, localStreamRef.current);
    });

    peerRef.current = peer;
    return peer;
  };

  const startCall = async () => {
    try {
      setError('');
      setStatus('connecting');

      const config = await getCallConfig();
      if (!config.enabled) throw new Error('Live calling is currently disabled.');
      iceServersRef.current = config.iceServers || [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const socket = createCustomerSocket();
      socketRef.current = socket;

      socket.on('connect_error', (connectError) => {
        setError(connectError.message || 'Could not connect to live call server.');
        setStatus('error');
      });

      socket.on('customer:call-accepted', async () => {
        const callId = callIdRef.current;
        if (!callId) return;
        const peer = createPeer(socket, callId);
        const offer = await peer.createOffer({ offerToReceiveAudio: true });
        await peer.setLocalDescription(offer);
        socket.emit('webrtc:offer', { callId, offer });
        setStatus('active');
      });

      socket.on('webrtc:answer', async ({ answer }) => {
        if (peerRef.current && answer) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      socket.on('webrtc:ice-candidate', async ({ candidate }) => {
        if (peerRef.current && candidate) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      socket.on('call:ended', () => {
        cleanup(false);
        setStatus('ended');
      });

      socket.on('connect', () => {
        socket.emit(
          'customer:start-call',
          { customerName: customerName || 'Website visitor', customerEmail },
          (response: { ok: boolean; callId?: string; iceServers?: RTCIceServer[]; message?: string }) => {
            if (!response.ok || !response.callId) {
              setError(response.message || 'Could not start call.');
              setStatus('error');
              return;
            }
            callIdRef.current = response.callId;
            if (response.iceServers) iceServersRef.current = response.iceServers;
            setStatus('ringing');
          }
        );
      });
    } catch (callError) {
      cleanup(false);
      setError(callError instanceof Error ? callError.message : 'Could not start live call.');
      setStatus('error');
    }
  };

  const endCall = () => {
    cleanup(true);
    setStatus('ended');
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  };

  const closePanel = () => {
    if (status === 'ringing' || status === 'active' || status === 'connecting') cleanup(true);
    if (!lockedOpen) setOpen(false);
    setStatus('idle');
    setError('');
  };

  return (
    <>
      {!hideFloatingButton && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full bg-gradient-to-r from-green-400 to-emerald-600 px-5 py-4 font-bold text-slate-950 shadow-2xl shadow-green-500/30 hover:scale-105 transition-all"
        >
          <PhoneCall size={22} />
          Live Call
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-100">{title}</h3>
                <p className="mt-1 text-sm text-gray-400">{description}</p>
              </div>
              {!lockedOpen && (
                <button type="button" onClick={closePanel} className="rounded-lg p-2 text-gray-400 hover:bg-slate-800 hover:text-white">
                  <X size={20} />
                </button>
              )}
            </div>

            {(status === 'idle' || status === 'error' || status === 'ended') && (
              <div className="space-y-4">
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-gray-100 outline-none focus:border-green-400"
                />
                <input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Your email or phone, optional"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-gray-100 outline-none focus:border-green-400"
                />
                {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
                {status === 'ended' && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">Call ended.</div>}
                <button
                  type="button"
                  onClick={startCall}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-400 to-emerald-600 px-5 py-4 font-bold text-slate-950 hover:shadow-lg hover:shadow-green-500/30"
                >
                  <PhoneCall size={20} />
                  Start Live Call
                </button>
              </div>
            )}

            {(status === 'connecting' || status === 'ringing' || status === 'active') && (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 text-green-400">
                  {status === 'connecting' ? <Loader2 className="animate-spin" size={36} /> : <PhoneCall size={36} />}
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-100">
                    {status === 'connecting' && 'Connecting...' }
                    {status === 'ringing' && 'Ringing admin...' }
                    {status === 'active' && 'Call active' }
                  </p>
                  <p className="mt-1 text-sm text-gray-400">Keep this tab open during the call.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-gray-100 hover:bg-slate-700"
                  >
                    {muted ? <MicOff size={18} /> : <Mic size={18} />}
                    {muted ? 'Unmute' : 'Mute'}
                  </button>
                  <button
                    type="button"
                    onClick={endCall}
                    className="flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 font-semibold text-white hover:bg-red-600"
                  >
                    <PhoneOff size={18} />
                    End
                  </button>
                </div>
              </div>
            )}

            <audio ref={remoteAudioRef} autoPlay playsInline />
          </div>
        </div>
      )}
    </>
  );
}
