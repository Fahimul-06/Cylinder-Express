import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { FileText, ImageIcon, Loader2, MessageCircle, Paperclip, Send, Video, X } from 'lucide-react';

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

function getVisitorId() {
  const key = 'portfolio_chat_visitor_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function formatFileSize(bytes = 0) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentPreview({ message }: { message: ChatMessage }) {
  if (!message.file_url) return null;

  if (message.message_type === 'image') {
    return (
      <a href={message.file_url} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-slate-700/70">
        <img src={message.file_url} alt={message.file_name || 'chat photo'} className="max-h-52 w-full object-cover" />
      </a>
    );
  }

  if (message.message_type === 'video') {
    return (
      <video src={message.file_url} controls playsInline className="mt-2 max-h-52 w-full rounded-xl border border-slate-700/70 bg-black" />
    );
  }

  return (
    <a href={message.file_url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-xs text-cyan-200 hover:border-cyan-400/60">
      <FileText size={18} />
      <span className="min-w-0 flex-1 truncate">{message.file_name || 'Download file'}</span>
      <span className="text-gray-500">{formatFileSize(message.file_size)}</span>
    </a>
  );
}

export function LiveChatWidget() {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('portfolio_chat_session_id') || '');
  const [visitorName, setVisitorName] = useState(() => localStorage.getItem('portfolio_chat_name') || '');
  const [visitorEmail, setVisitorEmail] = useState(() => localStorage.getItem('portfolio_chat_email') || '');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const visitorId = useMemo(() => getVisitorId(), []);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (!open || socketRef.current) return;

    const socket = io({ auth: { role: 'visitor' } });
    socketRef.current = socket;

    socket.on('chat:message', (message: ChatMessage) => {
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    });

    socket.on('connect_error', (err) => setError(err.message || 'Could not connect to live chat.'));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [open]);

  const startChat = async () => {
    setError('');
    const socket = socketRef.current;
    if (!socket) return setError('Chat connection is not ready yet.');

    socket.emit('visitor:chat-start', {
      sessionId,
      visitorId,
      name: visitorName || 'Website visitor',
      email: visitorEmail,
    }, (response: { ok: boolean; message?: string; session?: { id: string }; messages?: ChatMessage[] }) => {
      if (!response.ok || !response.session) {
        setError(response.message || 'Could not start chat.');
        return;
      }

      localStorage.setItem('portfolio_chat_session_id', response.session.id);
      localStorage.setItem('portfolio_chat_name', visitorName || 'Website visitor');
      localStorage.setItem('portfolio_chat_email', visitorEmail || '');
      setSessionId(response.session.id);
      setMessages(response.messages || []);
      setStarted(true);
    });
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
    const text = input.trim();
    if (!text && !attachment) return;
    const socket = socketRef.current;
    if (!socket || !sessionId) return setError('Chat is not connected.');

    setSending(true);
    setError('');
    socket.emit('chat:message', { sessionId, text, attachment }, (response: { ok: boolean; message?: string }) => {
      setSending(false);
      if (!response.ok) {
        setError(response.message || 'Message failed.');
        return;
      }
      setInput('');
    });
  };

  const handleFile = async (file?: File) => {
    if (!file || !started) return;
    setUploading(true);
    setError('');
    const uploaded = await uploadFile(file);
    setUploading(false);
    if (uploaded) await sendMessage(undefined, uploaded);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-4 font-bold text-white shadow-2xl shadow-cyan-500/30 transition hover:scale-105"
        >
          <MessageCircle size={22} />
          Live Chat
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-4 z-50 flex h-[620px] max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-cyan-400/30 bg-slate-950 shadow-2xl shadow-cyan-500/20">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-4">
            <div>
              <h3 className="font-black text-white">Live Chat</h3>
              <p className="text-xs text-gray-400">Send text, photos, videos, or files</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-2 text-gray-400 hover:bg-slate-800 hover:text-white">
              <X size={20} />
            </button>
          </div>

          {!started ? (
            <div className="flex flex-1 flex-col justify-center gap-4 p-5">
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
                Start a realtime chat with the admin. You can also attach a photo, video, PDF, or document after chat starts.
              </div>
              <input value={visitorName} onChange={(e) => setVisitorName(e.target.value)} placeholder="Your name" className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400" />
              <input value={visitorEmail} onChange={(e) => setVisitorEmail(e.target.value)} placeholder="Email or phone optional" className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400" />
              {error && <p className="text-sm text-red-300">{error}</p>}
              <button onClick={startChat} className="rounded-xl bg-cyan-500 px-4 py-3 font-bold text-white transition hover:bg-cyan-400">
                Start Chat
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-center text-sm text-gray-400">
                    No messages yet. Send the first message.
                  </div>
                )}
                {messages.map((message) => {
                  const mine = message.sender === 'visitor';
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${mine ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-gray-100'}`}>
                        {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
                        <AttachmentPreview message={message} />
                        <p className={`mt-2 text-[10px] ${mine ? 'text-cyan-100' : 'text-gray-500'}`}>{new Date(message.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {error && <p className="px-4 pb-2 text-xs text-red-300">{error}</p>}
              <form onSubmit={(event) => sendMessage(event)} className="border-t border-slate-800 bg-slate-900 p-3">
                <div className="flex items-end gap-2">
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" onChange={(e) => handleFile(e.target.files?.[0])} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded-xl border border-slate-700 p-3 text-gray-300 hover:border-cyan-400 hover:text-cyan-300 disabled:opacity-50">
                    {uploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
                  </button>
                  <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Write a message..." rows={1} className="max-h-28 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" />
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
        </div>
      )}
    </>
  );
}
