import { FormEvent, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, ShieldCheck, UserRoundCog } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_DASHBOARD_PATH } from '../lib/secureRoutes';

export default function ManagementLoginPage() {
  const { user, profile, signInManagement } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user && profile?.is_admin) return <Navigate to={ADMIN_DASHBOARD_PATH} replace />;
  if (user && !profile?.is_admin) return <Navigate to="/home" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Enter your employee code, phone or email and password.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await signInManagement(identifier.trim(), password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    navigate(ADMIN_DASHBOARD_PATH, { replace: true });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.28),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_32%)]" />
      <div className="relative w-full max-w-md rounded-3xl bg-white p-7 sm:p-9 shadow-2xl shadow-black/30 border border-white/20">
        <div className="text-center mb-7">
          <img src="/CylinderExprerssLOGO.png" alt="Cylinder Express" className="h-20 w-auto mx-auto object-contain" />
          <div className="mt-5 mx-auto h-14 w-14 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <UserRoundCog className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-slate-900">Management Login</h1>
          <p className="mt-2 text-sm text-slate-500">Administration Head & Employee access only</p>
        </div>

        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">Employee Code, Phone or Email</label>
            <div className="relative">
              <ShieldCheck className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                placeholder="6-digit code, phone or email"
                autoComplete="username"
                className="w-full rounded-xl border border-slate-200 py-3.5 pl-12 pr-4 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">Password</label>
            <div className="relative">
              <LockKeyhole className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter management password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-200 py-3.5 pl-12 pr-12 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
              />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Toggle password visibility">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button disabled={loading} type="submit" className="w-full rounded-xl bg-blue-700 py-3.5 font-extrabold text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800 disabled:opacity-60">
            {loading ? 'Signing In...' : 'Sign In to Management'}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-5 text-center">
          <button type="button" onClick={() => navigate('/login')} className="text-sm font-bold text-blue-700 hover:underline">
            Customer Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
