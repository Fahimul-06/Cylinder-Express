import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Phone, Mail, Lock, Eye, EyeOff, X, CheckCircle, ShieldCheck, Gauge, Headphones, Flame, UserRound } from 'lucide-react';

type ForgotStep = 'phone' | 'otp' | 'password' | 'success';

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<ForgotStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  async function sendOtp() {
    setError('');
    const cleaned = phone.replace(/\D/g, '');
    if (!/^01[3-9]\d{8}$/.test(cleaned)) {
      setError('Enter a valid Bangladesh mobile number (01XXXXXXXXX)');
      return;
    }
    setLoading(true);
    const res = await fetch(`${apiBaseUrl}/functions/v1/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleaned }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok || data.error) {
      setError(data.error || 'Failed to send OTP. Please try again.');
    } else {
      setStep('otp');
    }
  }

  async function verifyOtp() {
    setError('');
    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit OTP code');
      return;
    }
    setLoading(true);
    const res = await fetch(`${apiBaseUrl}/functions/v1/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.replace(/\D/g, ''), otp: otp.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok || data.error) {
      setError(data.error || 'Invalid OTP. Please try again.');
    } else {
      setResetToken(data.reset_token);
      setStep('password');
    }
  }

  async function resetPassword() {
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    const res = await fetch(`${apiBaseUrl}/functions/v1/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.replace(/\D/g, ''), reset_token: resetToken, new_password: newPassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok || data.error) {
      setError(data.error || 'Failed to reset password. Please try again.');
    } else {
      setStep('success');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Reset Password</h3>
            {step !== 'success' && (
              <p className="text-xs text-gray-400 mt-0.5">
                {step === 'phone' && 'Step 1 of 3 — Enter your phone number'}
                {step === 'otp' && 'Step 2 of 3 — Verify your phone'}
                {step === 'password' && 'Step 3 of 3 — Set new password'}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5">
          {step !== 'success' && (
            <div className="flex gap-1.5 mb-5">
              {(['phone', 'otp', 'password'] as ForgotStep[]).map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    step === s ? 'bg-blue-600' :
                    (['phone', 'otp', 'password'].indexOf(step) > i) ? 'bg-blue-200' : 'bg-gray-100'
                  }`}
                />
              ))}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {step === 'phone' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); setError(''); }}
                    placeholder="01XXXXXXXXX"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                    onKeyDown={e => e.key === 'Enter' && sendOtp()}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">We'll send an OTP to verify your account</p>
              </div>
              <button
                onClick={sendOtp}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-sm hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Verification Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                  placeholder="Enter 6-digit OTP"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                  onKeyDown={e => e.key === 'Enter' && verifyOtp()}
                />
                <p className="text-xs text-gray-400 mt-1.5">Code sent to {phone}</p>
              </div>
              <button
                onClick={verifyOtp}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-sm hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button
                onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Change phone number
              </button>
            </div>
          )}

          {step === 'password' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setError(''); }}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder="Re-enter your password"
                    className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={resetPassword}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-sm hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Password Reset!</h4>
              <p className="text-sm text-gray-500 mb-6">Your password has been updated successfully. You can now sign in with your new password.</p>
              <button
                onClick={onClose}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-sm hover:from-blue-700 hover:to-blue-800 transition-all"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('phone');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrPhone) {
      setError(loginMethod === 'phone' ? 'Enter your phone number' : 'Enter your email');
      return;
    }
    if (!password) {
      setError('Enter your password');
      return;
    }
    setLoading(true);
    setError('');
    const { error: signInError } = await signIn(emailOrPhone, password);
    if (signInError) {
      setError(signInError === 'Invalid login credentials'
        ? 'Invalid credentials. Please check your phone/email and password.'
        : signInError);
    } else {
      navigate('/home');
    }
    setLoading(false);
  };

  const featureItems = [
    { icon: ShieldCheck, title: 'নিরাপদ ডেলিভারি', subtitle: 'Safety verified gas service' },
    { icon: Gauge, title: 'দ্রুত সার্ভিস', subtitle: 'Fast cylinder delivery' },
    { icon: Headphones, title: '২৪/৭ কাস্টমার সাপোর্ট', subtitle: 'Always ready to help' },
  ];

  return (
    <>
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}

      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-900">
        <div className="absolute inset-0">
          <img
            src="/Cylinder-ExpressCover.png"
            alt="Cylinder Express LPG delivery background"
            className="h-full w-full object-cover object-center opacity-95"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/72 to-blue-900/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-white/10" />
          <div className="absolute inset-0 backdrop-blur-[1.5px]" />
        </div>

        <div className="relative z-10 flex min-h-screen flex-col px-4 py-6 sm:px-6 lg:px-10">
          <div className="grid flex-1 items-center gap-8 lg:grid-cols-[1fr_minmax(430px,520px)_1fr] lg:gap-6 xl:gap-12">
            <section className="hidden lg:flex min-h-[620px] flex-col justify-center pl-4 xl:pl-10">
              <div className="mb-12 flex items-center gap-4">
                <img src="/CylinderExprerssLOGO.png" alt="Cylinder Express" className="h-24 w-auto object-contain drop-shadow-sm" />
              </div>

              <div className="max-w-[430px] rounded-[2rem] bg-white/25 p-8 shadow-2xl shadow-blue-950/10 backdrop-blur-sm ring-1 ring-white/40">
                <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-blue-950 xl:text-5xl">
                  দ্রুত, নিরাপদ ও<br />নিশ্চিত গ্যাস সেবা
                </h1>
                <p className="mt-5 text-lg font-semibold text-blue-950/80">
                  আপনার নিরাপত্তা আমাদের অঙ্গীকার
                </p>

                <div className="mt-10 space-y-6">
                  {featureItems.map(({ icon: Icon, title, subtitle }) => (
                    <div key={title} className="flex items-center gap-5">
                      <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-blue-700 shadow-lg shadow-blue-600/10 ring-1 ring-blue-100">
                        <Icon className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-950">{title}</p>
                        <p className="text-sm font-medium text-slate-600">{subtitle}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mx-auto flex w-full max-w-[520px] items-center justify-center">
              <div className="w-full rounded-[2rem] bg-white/92 p-5 shadow-2xl shadow-blue-950/25 ring-1 ring-white/80 backdrop-blur-xl sm:p-8 md:p-10">
                <div className="mb-6 flex flex-col items-center text-center">
                  <img src="/CylinderExprerssLOGO.png" alt="Cylinder Express" className="h-20 w-auto object-contain" />
                  <h2 className="mt-5 text-2xl font-extrabold text-slate-900 sm:text-3xl">Welcome Back 👋</h2>
                  <p className="mt-2 text-sm font-medium text-slate-500 sm:text-base">Please sign in to your account</p>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
                  <button
                    type="button"
                    onClick={() => { setLoginMethod('phone'); setEmailOrPhone(''); setError(''); }}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
                      loginMethod === 'phone'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Phone className="h-4 w-4" /> Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLoginMethod('email'); setEmailOrPhone(''); setError(''); }}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
                      loginMethod === 'email'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Mail className="h-4 w-4" /> Email
                  </button>
                </div>

                {error && (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">
                      {loginMethod === 'phone' ? 'Phone Number' : 'Email Address'}
                    </label>
                    <div className="relative">
                      {loginMethod === 'phone' ? (
                        <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      ) : (
                        <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      )}
                      <input
                        type={loginMethod === 'phone' ? 'tel' : 'email'}
                        value={emailOrPhone}
                        onChange={e => { setEmailOrPhone(e.target.value); setError(''); }}
                        placeholder={loginMethod === 'phone' ? 'Enter your phone number' : 'Enter your email'}
                        required
                        className="w-full rounded-xl border border-slate-200 bg-white/90 py-3.5 pl-12 pr-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="block text-sm font-bold text-slate-700">Password</label>
                      <button
                        type="button"
                        onClick={() => setShowForgot(true)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700"
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError(''); }}
                        placeholder="Enter your password"
                        required
                        className="w-full rounded-xl border border-slate-200 bg-white/90 py-3.5 pl-12 pr-12 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <label className="flex cursor-pointer select-none items-center gap-2 font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Remember me
                    </label>
                    <button type="button" onClick={() => navigate('/home')} className="font-bold text-blue-600 hover:text-blue-700">
                      Visit Store
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-blue-700/25 transition-all hover:from-blue-700 hover:to-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'Signing In...' : 'Sign In'}
                  </button>
                </form>

                <div className="my-6 flex items-center gap-3 text-xs font-semibold text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  or continue with
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled
                    title="Social sign in coming soon"
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 py-3 text-sm font-bold text-slate-500 opacity-80"
                  >
                    <span className="text-base font-black text-red-500">G</span> Google
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Social sign in coming soon"
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 py-3 text-sm font-bold text-slate-500 opacity-80"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-xs font-black text-white">f</span> Facebook
                  </button>
                </div>

                <p className="mt-7 text-center text-sm font-medium text-slate-500">
                  Don't have an account?{' '}
                  <button onClick={() => navigate('/register')} className="font-extrabold text-blue-600 hover:text-blue-700">
                    Sign Up
                  </button>
                </p>
              </div>
            </section>

            <section className="hidden lg:flex min-h-[620px] items-end justify-end pr-4 xl:pr-10">
              <div className="max-w-[360px] rounded-[2rem] bg-blue-950/70 p-6 text-white shadow-2xl shadow-blue-950/30 backdrop-blur-md ring-1 ring-white/20">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                  <Flame className="h-8 w-8 text-orange-300" />
                </div>
                <h3 className="text-2xl font-extrabold">Cylinder Express</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-blue-50/90">
                  Fast LPG cylinder, stove, burner and safety service delivery for your home and business.
                </p>
                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/10 p-3">
                  <UserRound className="h-5 w-5 text-blue-100" />
                  <span className="text-sm font-semibold text-blue-50">Secure admin, delivery and customer access</span>
                </div>
              </div>
            </section>
          </div>

          <footer className="relative z-10 mt-8 text-center text-xs font-medium text-white/90 drop-shadow-md sm:text-sm">
            <p>© 2024 Cylinder Express. All rights reserved.</p>
            <p className="mt-1">cylinder-express.com</p>
          </footer>
        </div>
      </div>
    </>
  );
}
