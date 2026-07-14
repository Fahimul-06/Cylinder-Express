import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { FileText, ImageIcon, Loader2, MessageCircle, Paperclip, RefreshCw, Send, Video, XCircle } from 'lucide-react';

type ChatSession = {
  id: string;
  visitor_name: string;
  visitor_email: string;
  visitor_phone: string;
  status: 'open' | 'closed';
  last_message: string;
  last_message_at: string;
  unread_admin_count: number;
  unread_visitor_count: number;
  ip_address: string;
  user_agent: string;
};

type ChatMessage = {
  id: string;
  sender: 'visitor' | 'admin';
  message_type: 'text' | 'file' | 'image' | 'video';
  text: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
};

type UploadResult = {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  messageType: 'file' | 'image' | 'video';
};

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('admin_token') || '';
}

async function authedFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || `Request failed with status ${response.status}`);
  return payload;
}

function formatFileSize(bytes = 0) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function shortDate(value: string) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

function AttachmentPreview({ message }: { message: ChatMessage }) {
  if (!message.file_url) return null;

  if (message.message_type === 'image') {
    return (
      <a href={message.file_url} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-slate-700/70">
        <img src={message.file_url} alt={message.file_name || 'chat photo'} className="max-h-64 w-full object-cover" />
      </a>
    );
  }

  if (message.message_type === 'video') {
    return <video src={message.file_url} controls playsInline className="mt-2 max-h-64 w-full rounded-xl border border-slate-700/70 bg-black" />;
  }

  return (
    <a href={message.file_url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-xs text-cyan-200 hover:border-cyan-400/60">
      <FileText size={18} />
      <span className="min-w-0 flex-1 truncate">{message.file_name || 'Download file'}</span>
      <span className="text-gray-500">{formatFileSize(message.file_size)}</span>
    </a>
  );
}

export function AdminChatManager() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const selectedSession = useMemo(() => sessions.find((item) => item.id === selectedId) || null, [sessions, selectedId]);
  const openCount = useMemo(() => sessions.filter((item) => item.status === 'open').length, [sessions]);
  const unreadCount = useMemo(() => sessions.reduce((sum, item) => sum + (item.unread_admin_count || 0), 0), [sessions]);

  const upsertSession = (session: ChatSession) => {
    setSessions((current) => {
      const exists = current.some((item) => item.id === session.id);
      const next = exists ? current.map((item) => item.id === session.id ? session : item) : [session, ...current];
      return next.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    });
  };

  const loadSessions = async () => {
    setError('');
    setLoading(true);
    try {
      const docs = await authedFetch('/chat/sessions');
      setSessions(docs);
      if (!selectedId && docs[0]?.id) setSelectedId(docs[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load chats.');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (sessionId: string) => {
    if (!sessionId) return;
    setMessagesLoading(true);
    setError('');
    try {
      const docs = await authedFetch(`/chat/sessions/${sessionId}/messages`);
      setMessages(docs);
      setSessions((current) => current.map((item) => item.id === sessionId ? { ...item, unread_admin_count: 0 } : item));
      socketRef.current?.emit('chat:join-session', { sessionId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load messages.');
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    const token = getToken();
    const socket = io({ auth: { role: 'admin', token } });
    socketRef.current = socket;

    socket.on('chat:sessions', (items: ChatSession[]) => setSessions(items));
    socket.on('chat:session-updated', (session: ChatSession) => upsertSession(session));
    socket.on('chat:message', (message: ChatMessage) => {
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    });
    socket.on('chat:incoming-message', ({ session }: { session: ChatSession }) => {
      upsertSession(session);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`New chat from ${session.visitor_name || 'visitor'}`, { body: session.last_message || 'New message' });
      }
    });
    socket.on('connect_error', (err) => setError(err.message || 'Realtime chat connection failed.'));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    loadMessages(selectedId);
  }, [selectedId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const requestNotifications = async () => {
    if (!('Notification' in window)) return setError('This browser does not support notifications.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') setError('Notification permission was not allowed.');
  };

  const uploadFile = async (file: File): Promise<UploadResult | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'chat');
    const response = await fetch(`${API_BASE}/chat/upload`, { method: 'POST', body: formData });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.message || 'File upload failed.');
      return null;
    }
    return payload as UploadResult;
  };

  const sendMessage = async (event?: FormEvent, attachment?: UploadResult) => {
    event?.preventDefault();
    if (!selectedId) return;
    const text = input.trim();
    if (!text && !attachment) return;
    setSending(true);
    setError('');
    socketRef.current?.emit('chat:message', { sessionId: selectedId, text, attachment }, (response: { ok: boolean; message?: string }) => {
      setSending(false);
      if (!response.ok) {
        setError(response.message || 'Message failed.');
        return;
      }
      setInput('');
    });
  };

  const handleFile = async (file?: File) => {
    if (!file || !selectedId) return;
    setUploading(true);
    setError('');
    const uploaded = await uploadFile(file);
    setUploading(false);
    if (uploaded) await sendMessage(undefined, uploaded);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeSession = async () => {
    if (!selectedId) return;
    try {
      const updated = await authedFetch(`/chat/sessions/${selectedId}`, { method: 'PATCH', body: JSON.stringify({ status: selectedSession?.status === 'closed' ? 'open' : 'closed' }) });
      upsertSession(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update chat status.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-gray-400">Total Chats</p>
          <p className="mt-2 text-3xl font-black text-white">{sessions.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-gray-400">Open Chats</p>
          <p className="mt-2 text-3xl font-black text-green-300">{openCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-gray-400">Unread</p>
          <p className="mt-2 text-3xl font-black text-amber-300">{unreadCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={loadSessions} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-gray-200 hover:border-cyan-400">
          <RefreshCw size={16} /> Refresh
        </button>
        <button onClick={requestNotifications} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/20">
          <MessageCircle size={16} /> Enable Chat Notifications
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

      <div className="grid min-h-[680px] overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 lg:grid-cols-[340px_1fr]">
        <aside className="border-b border-slate-800 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-800 p-4">
            <h2 className="font-bold text-white">Visitor Chat Inbox</h2>
            <p className="text-xs text-gray-500">Realtime messages, photos, videos and files</p>
          </div>
          <div className="max-h-[620px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-2 p-5 text-gray-400"><Loader2 className="animate-spin" size={18} /> Loading chats...</div>
            ) : sessions.length === 0 ? (
              <div className="p-5 text-sm text-gray-500">No visitor chats yet.</div>
            ) : sessions.map((session) => (
              <button key={session.id} onClick={() => setSelectedId(session.id)} className={`w-full border-b border-slate-800 p-4 text-left transition hover:bg-slate-800/70 ${selectedId === session.id ? 'bg-cyan-500/10' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{session.visitor_name || 'Website visitor'}</p>
                    <p className="truncate text-xs text-gray-500">{session.visitor_email || session.ip_address || 'No contact info'}</p>
                  </div>
                  {session.unread_admin_count > 0 && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-slate-950">{session.unread_admin_count}</span>}
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-gray-400">{session.last_message || 'Chat started'}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600">
                  <span className={session.status === 'open' ? 'text-green-300' : 'text-gray-500'}>{session.status}</span>
                  <span>{shortDate(session.last_message_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[680px] flex-col">
          {!selectedSession ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-gray-500">
              Select a visitor chat to reply.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
                <div>
                  <h3 className="font-black text-white">{selectedSession.visitor_name || 'Website visitor'}</h3>
                  <p className="text-xs text-gray-500">{selectedSession.visitor_email || 'No email/phone'} • {selectedSession.ip_address || 'No IP'}</p>
                </div>
                <button onClick={closeSession} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-gray-200 hover:border-red-400 hover:text-red-200">
                  <XCircle size={16} /> {selectedSession.status === 'closed' ? 'Reopen' : 'Close'} Chat
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-950/50 p-4">
                {messagesLoading ? (
                  <div className="flex items-center gap-2 text-gray-400"><Loader2 className="animate-spin" size={18} /> Loading messages...</div>
                ) : messages.map((message) => {
                  const mine = message.sender === 'admin';
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${mine ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-gray-100'}`}>
                        {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
                        <AttachmentPreview message={message} />
                        <p className={`mt-2 text-[10px] ${mine ? 'text-cyan-100' : 'text-gray-500'}`}>{shortDate(message.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <form onSubmit={(event) => sendMessage(event)} className="border-t border-slate-800 bg-slate-900 p-4">
                <div className="flex items-end gap-2">
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" onChange={(e) => handleFile(e.target.files?.[0])} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded-xl border border-slate-700 p-3 text-gray-300 hover:border-cyan-400 hover:text-cyan-300 disabled:opacity-50">
                    {uploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
                  </button>
                  <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Reply to visitor..." rows={1} className="max-h-32 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" />
                  <button type="submit" disabled={sending || (!input.trim() && !uploading)} className="rounded-xl bg-cyan-500 p-3 text-white hover:bg-cyan-400 disabled:opacity-50">
                    {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1"><ImageIcon size={12} /> photo</span>
                  <span className="flex items-center gap-1"><Video size={12} /> video</span>
                  <span className="flex items-center gap-1"><FileText size={12} /> file</span>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
