import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL, supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Phone, Lock, Eye, EyeOff, Save,
  Check, Shield, ChevronRight, LogOut, MapPin, ShoppingBag, LayoutDashboard
} from 'lucide-react';
import { ADMIN_DASHBOARD_PATH } from '../lib/secureRoutes';



export default function ProfileDetailsPage() {
  const { profile, updateProfile, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [pwForm, setPwForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');



  const handleProfileSave = async () => {
    if (!form.full_name.trim()) {
      setProfileError('Name is required');
      return;
    }
    setSaving(true);
    setProfileError('');
    setProfileSaved(false);
    const { error } = await updateProfile({
      full_name: form.full_name,
      email: form.email || undefined,
      phone: form.phone,
    });
    if (error) {
      setProfileError(error);
    } else {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    }
    setSaving(false);
  };


  const handleAvatarUpload = async (file: File | null) => {
    if (!file || !profile) return;
    setAvatarUploading(true);
    setProfileError('');
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `avatars/${profile.user_id}-${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('avatars').upload(path, file);
    if (error || !data?.path) {
      setProfileError(error?.message || 'Failed to upload profile photo');
      setAvatarUploading(false);
      return;
    }
    const publicUrl = supabase.storage.from('avatars').getPublicUrl(data.path).data.publicUrl;
    const result = await updateProfile({ avatar_url: publicUrl });
    if (result.error) setProfileError(result.error);
    else setProfileSaved(true);
    setAvatarUploading(false);
  };

  const sendPasswordOtp = async () => {
    if (!profile?.phone) {
      setPwError('Phone number is required for OTP verification.');
      return;
    }
    setPwSaving(true);
    setPwError('');
    try {
      const res = await fetch(`${API_BASE_URL}/functions/v1/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: profile.phone.replace(/\D/g, '') }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to send OTP.');
      setOtpSent(true);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to send OTP.');
    }
    setPwSaving(false);
  };

  const handlePasswordChange = async () => {
    if (pwForm.newPassword.length < 6) {
      setPwError('Password must be at least 6 characters');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }
    if (!otpSent) {
      await sendPasswordOtp();
      return;
    }
    if (!otp || otp.length !== 6) {
      setPwError('Enter the 6-digit OTP sent to your phone.');
      return;
    }
    setPwSaving(true);
    setPwError('');
    setPwSaved(false);
    try {
      const verifyRes = await fetch(`${API_BASE_URL}/functions/v1/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: profile?.phone?.replace(/\D/g, ''), otp }),
      });
      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || verifyData.error) throw new Error(verifyData.error || 'Invalid OTP.');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Invalid OTP.');
      setPwSaving(false);
      return;
    }
    const { error } = await updatePassword(pwForm.newPassword);
    if (error) {
      setPwError(error);
    } else {
      setPwSaved(true);
      setPwForm({ newPassword: '', confirmPassword: '' });
      setOtp('');
      setOtpSent(false);
      setTimeout(() => setPwSaved(false), 3000);
    }
    setPwSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Profile Settings</h1>

        {/* Profile Header */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <div className="flex items-center gap-4">
            <label className="relative w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 cursor-pointer overflow-hidden bg-gradient-to-br from-blue-500 to-blue-700">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-white">{(profile?.full_name || 'U').charAt(0).toUpperCase()}</span>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarUpload(e.target.files?.[0] || null)} />
              <span className="absolute inset-x-0 bottom-0 bg-black/50 text-white text-[10px] text-center py-0.5">{avatarUploading ? 'Uploading' : 'Photo'}</span>
            </label>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{profile?.full_name}</h2>
              <p className="text-sm text-gray-500">{profile?.phone}</p>
              {profile?.email && <p className="text-sm text-gray-500">{profile?.email}</p>}
            </div>
          </div>
        </div>

        {/* Edit Profile */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <User className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-gray-900">Edit Profile</h3>
          </div>

          {profileError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {profileError}
            </div>
          )}
          {profileSaved && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
              <Check className="w-4 h-4" /> Profile updated successfully
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => setForm(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Your full name"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="01XXXXXXXXX"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Phone changes may require re-verification</p>
            </div>

            <button
              onClick={handleProfileSave}
              disabled={saving}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <Lock className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-gray-900">Change Password</h3>
          </div>

          {pwError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {pwError}
            </div>
          )}
          {pwSaved && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4" /> Password updated successfully
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={pwForm.newPassword}
                  onChange={e => setPwForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Min 6 characters"
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showConfirmPw ? 'text' : 'password'}
                  value={pwForm.confirmPassword}
                  onChange={e => setPwForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Re-enter new password"
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {otpSent && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">OTP Verification</label>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  className="w-full px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                <button type="button" onClick={sendPasswordOtp} className="text-xs text-blue-600 font-semibold mt-2">Resend OTP</button>
              </div>
            )}

            <button
              onClick={handlePasswordChange}
              disabled={pwSaving || !pwForm.newPassword || !pwForm.confirmPassword}
              className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {pwSaving ? 'Please wait...' : otpSent ? 'Verify OTP & Update Password' : 'Send OTP to Change Password'}
            </button>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
          {profile?.is_admin && (
            <>
              <button
                onClick={() => navigate(ADMIN_DASHBOARD_PATH)}
                className="w-full flex items-center justify-between p-4 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                    <LayoutDashboard className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-semibold text-blue-700">Administration Head Dashboard</span>
                    <p className="text-xs text-blue-500">Manage orders, products & offers</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-400" />
              </button>
              <div className="border-t border-gray-50" />
            </>
          )}
          <button
            onClick={() => navigate('/addresses')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-blue-500" />
              </div>
              <span className="text-sm font-medium text-gray-900">Delivery Addresses</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
          <div className="border-t border-gray-50" />
          <button
            onClick={() => navigate('/orders')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-green-500" />
              </div>
              <span className="text-sm font-medium text-gray-900">My Orders & Bookings</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-red-200 text-red-600 rounded-2xl font-semibold hover:bg-red-50 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
