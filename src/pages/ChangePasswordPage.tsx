import { useState } from 'react';
import { ArrowLeft, Check, Eye, EyeOff, Lock, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../lib/supabase';

export default function ChangePasswordPage() {
  const { profile, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const sendOtp = async () => {
    if (!profile?.phone) throw new Error('Phone number is required for OTP verification.');
    const response = await fetch(`${API_BASE_URL}/functions/v1/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: profile.phone.replace(/\D/g, '') }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(data.error || 'Failed to send OTP.');
    setOtpSent(true);
  };

  const handleSubmit = async () => {
    setError('');
    setSaved(false);
    if (form.newPassword.length < 6) return setError('Password must be at least 6 characters.');
    if (form.newPassword !== form.confirmPassword) return setError('Passwords do not match.');

    setSaving(true);
    try {
      if (!otpSent) {
        await sendOtp();
        return;
      }
      if (otp.length !== 6) throw new Error('Enter the 6-digit OTP sent to your phone.');
      const response = await fetch(`${API_BASE_URL}/functions/v1/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: profile?.phone?.replace(/\D/g, ''), otp }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.error || 'Invalid OTP.');

      const result = await updatePassword(form.newPassword);
      if (result.error) throw new Error(result.error);
      setSaved(true);
      setForm({ newPassword: '', confirmPassword: '' });
      setOtp('');
      setOtpSent(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <button onClick={() => navigate('/profile-settings')} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-blue-600">
          <ArrowLeft className="w-4 h-4" /> Profile Settings
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Change Password</h1>
              <p className="text-sm text-gray-500">OTP verification will be sent to {profile?.phone || 'your phone'}.</p>
            </div>
          </div>

          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
          {saved && <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2"><Check className="w-4 h-4" /> Password updated successfully.</div>}

          <div className="space-y-4">
            <PasswordInput label="New Password" value={form.newPassword} show={showNew} onToggle={() => setShowNew(!showNew)} onChange={(value) => setForm((old) => ({ ...old, newPassword: value }))} />
            <PasswordInput label="Confirm New Password" value={form.confirmPassword} show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} onChange={(value) => setForm((old) => ({ ...old, confirmPassword: value }))} />

            {otpSent && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">OTP Verification</label>
                <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter 6-digit OTP" className="w-full px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/20" />
                <button type="button" onClick={async () => { setError(''); try { await sendOtp(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed to resend OTP.'); } }} className="mt-2 text-xs text-blue-600 font-semibold">Resend OTP</button>
              </div>
            )}

            <button onClick={handleSubmit} disabled={saving || !form.newPassword || !form.confirmPassword} className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2">
              <Shield className="w-4 h-4" />
              {saving ? 'Please wait...' : otpSent ? 'Verify OTP & Update Password' : 'Send OTP to Change Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ label, value, show, onToggle, onChange }: { label: string; value: string; show: boolean; onToggle: () => void; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type={show ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Minimum 6 characters" className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
      </div>
    </div>
  );
}
