import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ProjectComment } from '../lib/supabase';
import { MessageSquare, Trash2, Eye, EyeOff, RefreshCw, Mail, Calendar } from 'lucide-react';

export function ProjectCommentsManager() {
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadComments = async () => {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('project_comments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message || 'Could not load project comments.');
      setComments([]);
    } else {
      setComments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadComments();
  }, []);

  const toggleApproval = async (comment: ProjectComment) => {
    setActionLoading(comment.id);
    const { error } = await supabase
      .from('project_comments')
      .update({ is_approved: !comment.is_approved })
      .eq('id', comment.id);

    if (error) {
      setError(error.message || 'Could not update comment.');
    } else {
      setComments((current) => current.map((item) => (
        item.id === comment.id ? { ...item, is_approved: !item.is_approved } : item
      )));
    }
    setActionLoading(null);
  };

  const deleteComment = async (id: string) => {
    if (!window.confirm('Delete this project comment permanently?')) return;
    setActionLoading(id);
    const { error } = await supabase.from('project_comments').delete().eq('id', id);
    if (error) {
      setError(error.message || 'Could not delete comment.');
    } else {
      setComments((current) => current.filter((item) => item.id !== id));
    }
    setActionLoading(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-100">
            <MessageSquare className="text-amber-400" size={32} />
            Project Comments
          </h1>
          <p className="mt-2 text-gray-400">Review, hide/show, or delete comments posted by visitors on project pages.</p>
        </div>
        <button
          type="button"
          onClick={loadComments}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-gray-300 transition-colors hover:border-amber-500 hover:text-amber-400 disabled:opacity-60"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 p-10 text-gray-400">
            <RefreshCw size={22} className="animate-spin text-amber-400" /> Loading project comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            No project comments yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {comments.map((comment) => (
              <div key={comment.id} className="p-5">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-100">{comment.name}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${comment.is_approved ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700 text-gray-300'}`}>
                        {comment.is_approved ? 'Visible' : 'Hidden'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-cyan-300">{comment.project_title || 'Project'}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1"><Mail size={13} /> {comment.email}</span>
                      <span className="inline-flex items-center gap-1"><Calendar size={13} /> {new Date(comment.created_at).toLocaleString()}</span>
                      {comment.ip_address && <span>IP: {comment.ip_address}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleApproval(comment)}
                      disabled={actionLoading === comment.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-amber-500 hover:text-amber-400 disabled:opacity-60"
                    >
                      {comment.is_approved ? <EyeOff size={16} /> : <Eye size={16} />}
                      {comment.is_approved ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteComment(comment.id)}
                      disabled={actionLoading === comment.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-60"
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </div>

                <p className="whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-relaxed text-gray-300">
                  {comment.comment}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
