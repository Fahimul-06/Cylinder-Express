import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Trash2, ShieldCheck, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL, supabase } from '../lib/supabase';

export default function AccountDeletionPage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const deleteAccount = async () => {
    if (confirmation.trim().toUpperCase() !== 'DELETE') {
      setError('Type DELETE to confirm permanent deletion.');
      return;
    }
    setDeleting(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Your session expired. Please sign in again.');
      const response = await fetch(`${API_BASE_URL}/api/auth/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.error) throw new Error(payload.error || 'Account deletion failed.');
      await signOut();
      navigate('/home', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account deletion failed.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Delete Cylinder Express Account</h1>
              <p className="mt-2 text-sm text-gray-600">
                This page is available both inside the app and on the web so customers can permanently delete their account and associated personal data.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">This action cannot be undone.</p>
                <p className="mt-1">Your customer profile, saved addresses, orders and order items, service bookings, LPG usage records, location records, customer-care messages and notifications will be removed from the active system.</p>
              </div>
            </div>
          </div>

          {!user ? (
            <div className="mt-6">
              <p className="text-sm text-gray-600">Sign in to your customer account to verify ownership before deleting it.</p>
              <button onClick={() => navigate('/login')} className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700">
                <LogIn className="w-4 h-4" /> Sign In to Delete Account
              </button>
            </div>
          ) : profile?.role !== 'customer' ? (
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              This self-service page is only for customer accounts. Management and HUB Man accounts are controlled by the Administration Head.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                Signed in as <span className="font-semibold text-gray-900">{profile.full_name}</span>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Type DELETE to confirm</label>
                <input
                  value={confirmation}
                  onChange={(e) => { setConfirmation(e.target.value); setError(''); }}
                  autoComplete="off"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  placeholder="DELETE"
                />
              </div>

              {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

              <button
                onClick={deleteAccount}
                disabled={deleting || confirmation.trim().toUpperCase() !== 'DELETE'}
                className="w-full py-3.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting Account...' : 'Permanently Delete My Account'}
              </button>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-gray-100 text-xs text-gray-500 space-y-1">
            <p>Privacy policy: cylinder-express.com/#/privacy-policy</p>
            <p>Customer Care: 01967517077 / 01409472939</p>
          </div>
        </div>
      </div>
    </div>
  );
}
