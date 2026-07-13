import { FormEvent, useState } from 'react';
import { Eye, EyeOff, Lock, Phone, ShieldCheck, Truck } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_DASHBOARD_PATH, DELIVERY_DASHBOARD_PATH } from '../lib/secureRoutes';

type StaffPortal = 'admin' | 'delivery';

export default function StaffLoginPage({ portal }: { portal: StaffPortal }) {
  const { user, profile, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = Boolean(profile?.is_admin) || profile?.role === 'admin' || profile?.role === 'sub_admin';
  const isDelivery = profile?.role === 'delivery';
  if (user && ((portal === 'admin' && isAdmin) || (portal === 'delivery' && isDelivery))) {
    return <Navigate to={portal === 'admin' ? ADMIN_DASHBOARD_PATH : DELIVERY_DASHBOARD_PATH} replace />;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    if (user) await signOut();
    const result = await signIn(identifier.trim(), password, portal);
    if (result.error) setError(result.error);
    else navigate(portal === 'admin' ? ADMIN_DASHBOARD_PATH : DELIVERY_DASHBOARD_PATH, { replace: true });
    setLoading(false);
  }

  const AdminIcon = portal === 'admin' ? ShieldCheck : Truck;
  const title = portal === 'admin' ? 'Administrator Access' : 'Delivery Partner Access';
  const subtitle = portal === 'admin' ? 'Authorized management accounts only' : 'Authorized delivery accounts only';

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl sm:p-9">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/15 text-blue-400 ring-1 ring-blue-500/25">
            <AdminIcon className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">{title}</h1>
          <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
        </div>
        {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">Phone or email</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoComplete="username" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3.5 pl-12 pr-4 text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3.5 pl-12 pr-12 text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" aria-label="Toggle password visibility">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <button disabled={loading} className="w-full rounded-xl bg-blue-600 py-3.5 font-bold text-white hover:bg-blue-500 disabled:opacity-60">
            {loading ? 'Verifying access…' : 'Sign in securely'}
          </button>
        </form>
      </section>
    </main>
  );
}
