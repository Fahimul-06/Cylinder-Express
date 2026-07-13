import { FormEvent, useEffect, useState } from 'react';
import { Lock, Mail, ShieldCheck, Truck, Eye, EyeOff } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ADMIN_DASHBOARD_PATH,
  ADMIN_LOGIN_PATH,
  DELIVERY_DASHBOARD_PATH,
  DELIVERY_LOGIN_PATH,
} from '../lib/secureRoutes';

type Portal = 'admin' | 'delivery';

export default function PortalLoginPage({ portal }: { portal: Portal }) {
  const { user, profile, portalSignIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = portal === 'admin';
  const dashboardPath = isAdmin ? ADMIN_DASHBOARD_PATH : DELIVERY_DASHBOARD_PATH;
  const expectedRole = isAdmin ? Boolean(profile?.is_admin) : profile?.role === 'delivery';

  useEffect(() => {
    if (user && profile && !expectedRole) {
      void signOut();
    }
  }, [user, profile, expectedRole, signOut]);

  if (user && profile && expectedRole) return <Navigate to={dashboardPath} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Enter your login ID and password.');
      return;
    }
    setLoading(true);
    const result = await portalSignIn(portal, identifier.trim(), password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate(dashboardPath, { replace: true });
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white">
          {isAdmin ? <ShieldCheck size={34} /> : <Truck size={34} />}
        </div>
        <h1 className="text-center text-2xl font-bold text-slate-900">
          {isAdmin ? 'Cylinder Express Admin' : 'Cylinder Express Delivery'}
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Restricted staff portal. Authorized users only.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              {isAdmin ? 'Admin email' : 'Phone or email'}
            </span>
            <div className="flex items-center rounded-xl border border-slate-300 px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
              <Mail size={18} className="text-slate-400" />
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="w-full bg-transparent px-3 py-3 outline-none"
                autoComplete="username"
                placeholder={isAdmin ? 'admin@example.com' : 'Phone or email'}
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
            <div className="flex items-center rounded-xl border border-slate-300 px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
              <Lock size={18} className="text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full bg-transparent px-3 py-3 outline-none"
                autoComplete="current-password"
                placeholder="Enter password"
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-slate-500" aria-label="Toggle password visibility">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {loading ? 'Signing in…' : 'Secure Sign In'}
          </button>
        </form>
      </section>
    </main>
  );
}

export function LegacyAdminLoginRedirect() {
  return <Navigate to={ADMIN_LOGIN_PATH} replace />;
}

export function LegacyDeliveryLoginRedirect() {
  return <Navigate to={DELIVERY_LOGIN_PATH} replace />;
}
