import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Search, Send, Truck } from 'lucide-react';
import { apiClient } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Conversation = { delivery_user_id: string; full_name: string; phone: string; avatar_url?: string | null; last_message: string; last_message_at: string; unread_count: number };
type ChatMessage = { id: string; sender_id: string; sender_role: 'delivery' | 'admin'; message: string; created_at: string };

export default function AdminDeliveryChat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const result = await apiClient<{ data: Conversation[] }>('/api/delivery-chat/conversations');
      setConversations(result.data || []);
      setSelectedId(current => current || result.data?.[0]?.delivery_user_id || '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load delivery conversations.'); }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!selectedId) { setMessages([]); return; }
    try {
      const result = await apiClient<{ data: ChatMessage[] }>(`/api/delivery-chat/messages?delivery_user_id=${encodeURIComponent(selectedId)}`);
      setMessages(result.data || []);
      await apiClient('/api/delivery-chat/read', { method: 'POST', body: JSON.stringify({ delivery_user_id: selectedId }) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load messages.'); }
  }, [selectedId]);

  useEffect(() => { loadConversations(); const timer = window.setInterval(loadConversations, 2000); return () => window.clearInterval(timer); }, [loadConversations]);
  useEffect(() => { loadMessages(); const timer = window.setInterval(loadMessages, 2000); return () => window.clearInterval(timer); }, [loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, selectedId]);

  const send = async (event: FormEvent) => {
    event.preventDefault(); const message = text.trim(); if (!message || !selectedId) return;
    try { await apiClient('/api/delivery-chat/messages', { method: 'POST', body: JSON.stringify({ delivery_user_id: selectedId, message }) }); setText(''); await loadMessages(); await loadConversations(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Message could not be sent.'); }
  };

  const selected = conversations.find(c => c.delivery_user_id === selectedId);
  const filtered = conversations.filter(c => `${c.full_name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="p-4 sm:p-6 lg:p-8"><div className="max-w-6xl mx-auto">
    <div className="mb-5"><h1 className="text-2xl font-bold text-gray-900">Delivery Live Messages</h1><p className="text-sm text-gray-500">Chat with delivery personnel in near real time.</p></div>
    {error && <p className="mb-3 p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</p>}
    <div className="bg-white border rounded-2xl overflow-hidden h-[72vh] grid md:grid-cols-[320px_1fr]">
      <aside className="border-r flex flex-col min-h-0">
        <div className="p-3 border-b"><div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search delivery person" className="w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm" /></div></div>
        <div className="overflow-y-auto flex-1">
          {filtered.map(c => <button key={c.delivery_user_id} onClick={() => setSelectedId(c.delivery_user_id)} className={`w-full text-left p-4 border-b hover:bg-gray-50 ${selectedId === c.delivery_user_id ? 'bg-blue-50' : ''}`}>
            <div className="flex gap-3"><div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><Truck className="w-5 h-5 text-blue-600" /></div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="font-semibold text-sm truncate">{c.full_name}</p>{c.unread_count > 0 && <span className="bg-red-500 text-white text-[10px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center">{c.unread_count}</span>}</div><p className="text-xs text-gray-500">{c.phone}</p><p className="text-xs text-gray-400 truncate mt-1">{c.last_message || 'No messages yet'}</p></div></div>
          </button>)}
          {filtered.length === 0 && <p className="p-8 text-center text-sm text-gray-400">No delivery person found.</p>}
        </div>
      </aside>
      <section className="flex flex-col min-w-0 min-h-0">
        {selected ? <>
          <header className="p-4 border-b flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><Truck className="w-5 h-5 text-blue-600" /></div><div><p className="font-bold">{selected.full_name}</p><p className="text-xs text-gray-500">{selected.phone} · live messaging</p></div></header>
          <main className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">{messages.map(m => { const mine = m.sender_id === user?.id || m.sender_role === 'admin'; return <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${mine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white border rounded-bl-md'}`}><p className="text-sm whitespace-pre-wrap break-words">{m.message}</p><p className={`text-[10px] mt-1 ${mine ? 'text-blue-100' : 'text-gray-400'}`}>{new Date(m.created_at).toLocaleString()}</p></div></div>; })}<div ref={bottomRef} /></main>
          <form onSubmit={send} className="p-3 border-t flex gap-2"><input value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder="Write a message..." className="flex-1 border rounded-xl px-4 py-3 text-sm" /><button disabled={!text.trim()} className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-40"><Send className="w-5 h-5" /></button></form>
        </> : <div className="flex-1 flex flex-col items-center justify-center text-gray-400"><MessageCircle className="w-12 h-12 mb-3" /><p>Select a delivery person to start chatting.</p></div>}
      </section>
    </div>
  </div></div>;
}
