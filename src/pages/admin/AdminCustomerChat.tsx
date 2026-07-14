import { FormEvent, useEffect, useRef, useState } from 'react';
import { MessageCircle, Search, Send, UserRound } from 'lucide-react';
import { apiClient } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Conversation = { customer_user_id: string; full_name: string; phone: string; avatar_url?: string | null; last_message: string; last_message_at: string; unread_count: number };
type ChatMessage = { id: string; sender_id: string; sender_role: 'customer' | 'admin'; message: string; created_at: string; sender_name?: string | null; sender_position?: string | null };

export default function AdminCustomerChat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    try {
      const result = await apiClient<{ data: Conversation[] }>('/api/customer-chat/conversations');
      setConversations(result.data || []);
      if (!selectedId && result.data?.length) setSelectedId(result.data[0].customer_user_id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load customer conversations.'); }
  };
  const loadMessages = async () => {
    if (!selectedId) return;
    try {
      const result = await apiClient<{ data: ChatMessage[] }>(`/api/customer-chat/messages?customer_user_id=${encodeURIComponent(selectedId)}`);
      setMessages(result.data || []);
      await apiClient('/api/customer-chat/read', { method: 'POST', body: JSON.stringify({ customer_user_id: selectedId }) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load messages.'); }
  };
  useEffect(() => { loadConversations(); const timer = setInterval(loadConversations, 2500); return () => clearInterval(timer); }, []);
  useEffect(() => { loadMessages(); const timer = setInterval(loadMessages, 2000); return () => clearInterval(timer); }, [selectedId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, selectedId]);

  const send = async (event: FormEvent) => {
    event.preventDefault(); const message = text.trim(); if (!message || !selectedId) return;
    try {
      await apiClient('/api/customer-chat/messages', { method: 'POST', body: JSON.stringify({ customer_user_id: selectedId, message }) });
      setText(''); await loadMessages(); await loadConversations();
    } catch (e) { setError(e instanceof Error ? e.message : 'Message could not be sent.'); }
  };

  const filtered = conversations.filter(c => `${c.full_name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()));
  const selected = conversations.find(c => c.customer_user_id === selectedId);

  return <div className="p-4 sm:p-6 lg:p-8">
    <div className="mb-5"><h1 className="text-2xl font-bold text-gray-900">Customer Messages</h1><p className="text-sm text-gray-500">View customer questions and reply in real time.</p></div>
    {error && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
    <div className="bg-white border rounded-2xl overflow-hidden h-[70vh] min-h-[520px] flex">
      <aside className="w-full md:w-80 border-r flex flex-col">
        <div className="p-3 border-b"><div className="relative"><Search className="w-4 h-4 absolute left-3 top-3 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customer" className="w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm"/></div></div>
        <div className="overflow-y-auto flex-1">{filtered.map(c => <button key={c.customer_user_id} onClick={()=>setSelectedId(c.customer_user_id)} className={`w-full text-left p-3 border-b hover:bg-gray-50 ${selectedId===c.customer_user_id?'bg-blue-50':''}`}>
          <div className="flex gap-3"><div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><UserRound className="w-5 h-5 text-blue-600"/></div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="font-semibold text-sm truncate">{c.full_name}</p>{c.unread_count>0&&<span className="bg-red-500 text-white text-[10px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center">{c.unread_count}</span>}</div><p className="text-xs text-gray-500">{c.phone}</p><p className="text-xs text-gray-400 truncate mt-1">{c.last_message||'No messages yet'}</p></div></div>
        </button>)}</div>
      </aside>
      <section className={`${selectedId?'flex':'hidden md:flex'} flex-1 flex-col`}>
        {selected ? <><header className="p-4 border-b flex items-center gap-3"><MessageCircle className="w-5 h-5 text-blue-600"/><div><p className="font-semibold">{selected.full_name}</p><p className="text-xs text-gray-500">{selected.phone}</p></div></header>
        <main className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">{messages.map(m=>{const mine=m.sender_id===user?.id||m.sender_role==='admin';return <div key={m.id} className={`flex ${mine?'justify-end':'justify-start'}`}><div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${mine?'bg-blue-600 text-white rounded-br-md':'bg-white border rounded-bl-md'}`}>{m.sender_role==='admin'&&<p className={`text-[11px] font-semibold mb-1 ${mine?'text-blue-100':'text-blue-600'}`}>{m.sender_name||'Administration Head'}{m.sender_position?` · ${m.sender_position}`:''}</p>}<p className="text-sm whitespace-pre-wrap break-words">{m.message}</p><p className={`text-[10px] mt-1 ${mine?'text-blue-100':'text-gray-400'}`}>{new Date(m.created_at).toLocaleString()}</p></div></div>})}<div ref={bottomRef}/></main>
        <form onSubmit={send} className="p-3 border-t flex gap-2"><input value={text} onChange={e=>setText(e.target.value)} maxLength={2000} placeholder="Write a reply..." className="flex-1 border rounded-xl px-4 py-3 text-sm"/><button disabled={!text.trim()} className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-40"><Send className="w-5 h-5"/></button></form></>:<div className="m-auto text-center text-gray-400"><MessageCircle className="w-12 h-12 mx-auto mb-3"/><p>Select a customer conversation</p></div>}
      </section>
    </div>
  </div>;
}
