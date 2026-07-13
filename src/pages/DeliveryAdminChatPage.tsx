import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Headphones, Send, Wifi } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/supabase';
import { DELIVERY_DASHBOARD_PATH } from '../lib/secureRoutes';
import { useAuth } from '../contexts/AuthContext';

type ChatMessage = { id: string; sender_id: string; sender_role: 'delivery' | 'admin'; message: string; created_at: string };

export default function DeliveryAdminChatPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiClient<{ data: ChatMessage[] }>('/api/delivery-chat/messages');
      setMessages(result.data || []);
      await apiClient('/api/delivery-chat/read', { method: 'POST', body: JSON.stringify({}) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load messages.'); }
  }, []);

  useEffect(() => { load(); const timer = window.setInterval(load, 2000); return () => window.clearInterval(timer); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || sending) return;
    setSending(true); setError('');
    try {
      await apiClient('/api/delivery-chat/messages', { method: 'POST', body: JSON.stringify({ message }) });
      setText(''); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Message could not be sent.'); }
    finally { setSending(false); }
  };

  return <div className="min-h-screen bg-slate-50 pt-24 pb-6 px-3 sm:px-6">
    <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
      <header className="p-4 border-b flex items-center gap-3 bg-blue-600 text-white">
        <button onClick={() => navigate(DELIVERY_DASHBOARD_PATH)} className="p-2 rounded-lg hover:bg-white/15"><ArrowLeft className="w-5 h-5" /></button>
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><Headphones className="w-5 h-5" /></div>
        <div><h1 className="font-bold">Admin Live Support</h1><p className="text-xs text-blue-100 flex items-center gap-1"><Wifi className="w-3 h-3" /> Messages update live</p></div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {messages.length === 0 && <div className="text-center text-sm text-gray-500 mt-16">Send a message to the admin for delivery help, order issues, or account support.</div>}
        {messages.map(m => {
          const mine = m.sender_id === user?.id || m.sender_role === 'delivery';
          return <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white border text-gray-800 rounded-bl-md'}`}><p className="text-sm whitespace-pre-wrap break-words">{m.message}</p><p className={`text-[10px] mt-1 ${mine ? 'text-blue-100' : 'text-gray-400'}`}>{new Date(m.created_at).toLocaleString()}</p></div></div>;
        })}
        <div ref={bottomRef} />
      </main>
      {error && <p className="px-4 py-2 text-xs text-red-600 bg-red-50">{error}</p>}
      <form onSubmit={send} className="p-3 border-t flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder={`Message admin as ${profile?.full_name || 'delivery person'}...`} className="flex-1 border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <button disabled={!text.trim() || sending} className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-40"><Send className="w-5 h-5" /></button>
      </form>
    </div>
  </div>;
}
