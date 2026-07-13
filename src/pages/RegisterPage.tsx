import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Phone, Mail, User, Lock, Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const sendOtp = async () => {
    const phoneRegex = /^01[3-9]\d{8}$/;
    if (!form.phone || !phoneRegex.test(form.phone.replace(/\D/g, ''))) {
      setError('Enter a valid 11-digit Bangladesh mobile number (e.g. 01XXXXXXXXX)');
      return;
    }
    setSendingOtp(true);
    setError('');
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/functions/v1/send-otp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: form.phone }),
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to send OTP. Please try again.');
      } else {
        setOtpSent(true);
      }
    } catch {
      setError('Failed to send OTP. Please check your connection and try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.length < 6) {
      setError('Enter the 6-digit OTP sent to your phone');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/functions/v1/verify-otp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: form.phone, otp }),
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Invalid OTP. Please try again.');
      } else {
        setOtpVerified(true);
      }
    } catch {
      setError('Verification failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpVerified) {
      setError('Please verify your phone number with OTP first');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    const email = form.email || `${form.phone}@cylinderexpress.bd`;
    const { error: signUpError } = await signUp(email, form.password, form.fullName, form.phone);
    if (signUpError) {
      setError(signUpError);
    } else {
      navigate('/home');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mb-8 backdrop-blur-sm">
            <img src="/CylinderExprerssLOGO.png" alt="Cylinder Express" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Cylinder<span className="text-blue-200">Express</span></h1>
          <p className="text-xl text-blue-100 mb-8">Bangladesh's trusted LPG delivery service</p>
          <div className="space-y-4">
            {['Doorstep cylinder delivery', 'Professional installation services', 'Verified & safe products'].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <ArrowRight className="w-3 h-3" />
                </div>
                <span className="text-blue-100">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/5 rounded-full" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/CylinderExprerssLOGO.png" alt="Cylinder Express" className="w-10 h-10 object-contain" />
            <span className="font-bold text-xl text-gray-900">Cylinder<span className="text-blue-600">Express</span></span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Account</h2>
          <p className="text-gray-500 mb-8">Join CylinderExpress for fast LPG delivery in Bangladesh</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  name="fullName"
                  type="text"
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email (Optional)</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="01XXXXXXXXX"
                    required
                    disabled={otpVerified}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all disabled:bg-green-50 disabled:border-green-200"
                  />
                </div>
                {!otpVerified && (
                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={sendingOtp || !form.phone}
                    className="px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    {sendingOtp ? 'Sending...' : otpSent ? 'Resend' : 'Send OTP'}
                  </button>
                )}
              </div>
              {otpVerified && (
                <div className="flex items-center gap-2 mt-2 text-green-600 text-sm">
                  <Shield className="w-4 h-4" />
                  Phone number verified
                </div>
              )}
            </div>

            {otpSent && !otpVerified && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Verify OTP</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={verifyOtp}
                    disabled={loading || !otp}
                    className="px-4 py-3 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-all disabled:opacity-50"
                  >
                    Verify
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Enter the 6-digit code sent to {form.phone}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min 6 characters"
                  required
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  name="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  required
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !otpVerified}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-sm hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} className="text-blue-600 font-semibold hover:text-blue-700">
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
