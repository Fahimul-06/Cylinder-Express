import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_DASHBOARD_PATH } from '../lib/secureRoutes';

export default function AdminLoginPage() {
  const { signInAdmin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setLoading(true);
    const result = await signInAdmin(email, password);
    setLoading(false);
    if (result.error) return setError(result.error);
    navigate(ADMIN_DASHBOARD_PATH, { replace: true });
  }

  return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
      <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-5"><ShieldCheck className="w-8 h-8" /></div>
      <h1 className="text-2xl font-bold text-center text-slate-900">Cylinder Express Admin</h1>
      <p className="text-sm text-slate-500 text-center mt-2 mb-7">Authorized administrators only</p>
      {error && <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Admin email" autoComplete="username" className="w-full pl-12 pr-4 py-3.5 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" required/></div>
        <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"/><input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Admin password" autoComplete="current-password" className="w-full pl-12 pr-12 py-3.5 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" required/><button type="button" onClick={()=>setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">{show?<EyeOff className="w-5 h-5"/>:<Eye className="w-5 h-5"/>}</button></div>
        <button disabled={loading} className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60">{loading?'Signing in...':'Admin Sign In'}</button>
      </form>
    </div>
  </div>;
}
