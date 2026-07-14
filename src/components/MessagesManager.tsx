import { useState, useEffect } from 'react';
import { supabase, Message } from '../lib/supabase';
import {
  Loader2,
  Mail,
  MailOpen,
  Trash2,
  AlertCircle,
  User,
  Calendar,
  Inbox,
  CheckCircle2,
  X,
} from 'lucide-react';

export function MessagesManager() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError('Failed to load messages');
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_read: true } : m))
      );
      if (selectedMessage?.id === id) {
        setSelectedMessage((prev) => (prev ? { ...prev, is_read: true } : null));
      }
    }
  };

  const deleteMessage = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('messages').delete().eq('id', id);
    setDeletingId(null);

    if (!error) {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedMessage?.id === id) {
        setSelectedMessage(null);
      }
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const unreadCount = messages.filter((m) => !m.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400 flex items-center gap-3">
        <AlertCircle size={20} />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Inbox size={20} className="text-amber-500" />
            </div>
            <span className="text-sm text-gray-400">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-100">{messages.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Mail size={20} className="text-cyan-400" />
            </div>
            <span className="text-sm text-gray-400">Unread</span>
          </div>
          <p className="text-2xl font-bold text-gray-100">{unreadCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 col-span-2 md:col-span-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <CheckCircle2 size={20} className="text-emerald-400" />
            </div>
            <span className="text-sm text-gray-400">Read</span>
          </div>
          <p className="text-2xl font-bold text-gray-100">
            {messages.length - unreadCount}
          </p>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <Inbox size={48} className="text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300">No messages yet</h3>
          <p className="text-gray-500 mt-1">
            Messages from your contact form will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                    From
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4 hidden md:table-cell">
                    Email
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4 hidden lg:table-cell">
                    Preview
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4 hidden sm:table-cell">
                    Date
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {messages.map((msg) => (
                  <tr
                    key={msg.id}
                    className={`group transition-colors hover:bg-slate-800/50 cursor-pointer ${
                      !msg.is_read ? 'bg-slate-800/30' : ''
                    }`}
                    onClick={() => {
                      setSelectedMessage(msg);
                      if (!msg.is_read) markAsRead(msg.id);
                    }}
                  >
                    <td className="px-6 py-4">
                      {msg.is_read ? (
                        <MailOpen size={18} className="text-gray-500" />
                      ) : (
                        <Mail size={18} className="text-cyan-400" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-gray-500" />
                        <span className="text-sm font-medium text-gray-200">
                          {msg.name}
                        </span>
                        {!msg.is_read && (
                          <span className="w-2 h-2 bg-cyan-400 rounded-full" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="text-sm text-gray-400">{msg.email}</span>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="text-sm text-gray-400 truncate max-w-xs block">
                        {msg.message}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar size={14} />
                        {formatDate(msg.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMessage(msg.id);
                        }}
                        disabled={deletingId === msg.id}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        {deletingId === msg.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedMessage(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Mail size={20} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-100">
                    {selectedMessage.name}
                  </h3>
                  <p className="text-xs text-gray-500">{selectedMessage.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="p-2 text-gray-500 hover:text-gray-300 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Calendar size={14} />
                <span>{formatDate(selectedMessage.created_at)}</span>
                {selectedMessage.is_read && (
                  <span className="ml-2 flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 size={12} />
                    Read
                  </span>
                )}
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {selectedMessage.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
              <a
                href={`mailto:${selectedMessage.email}`}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors text-sm font-medium"
              >
                <Mail size={16} />
                Reply via Email
              </a>
              <button
                onClick={() => deleteMessage(selectedMessage.id)}
                disabled={deletingId === selectedMessage.id}
                className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
              >
                {deletingId === selectedMessage.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
