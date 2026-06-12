import { useEffect, useMemo, useState } from 'react';
import { Search, Users, ShieldCheck, UserPlus, Phone, Lock, Image as ImageIcon, CheckCircle, XCircle } from 'lucide-react';
import { apiClient, supabase } from '../../lib/supabase';
import { ADMIN_PERMISSION_LABELS, AdminPermissionKey, Profile } from '../../lib/types';

const PERMISSIONS = Object.keys(ADMIN_PERMISSION_LABELS) as AdminPermissionKey[];

const emptyPermissions = PERMISSIONS.reduce((acc, key) => {
  acc[key] = false;
  return acc;
}, {} as Record<AdminPermissionKey, boolean>);

interface CreateResponse {
  data: Profile;
  sms?: { sent?: boolean; skipped?: boolean };
  error?: string | null;
}

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    password: '',
    permissions: { ...emptyPermissions },
  });

  const loadProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    setProfiles((data || []) as Profile[]);
    setLoading(false);
  };

  useEffect(() => { loadProfiles(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((profile) => [
      profile.full_name,
      profile.phone,
      profile.email || '',
      profile.role || '',
    ].join(' ').toLowerCase().includes(q));
  }, [profiles, search]);

  const registeredUsers = filtered.filter((profile) => !profile.is_admin);
  const admins = filtered.filter((profile) => profile.is_admin);

  const createSubAdmin = async () => {
    setError('');
    setMessage('');
    if (!form.full_name.trim() || !form.phone.trim() || !form.password.trim()) {
      setError('Name, phone and password are required.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    try {
      const result = await apiClient<CreateResponse>('/api/admin/subadmins', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setMessage(result.sms?.sent
        ? 'Sub-admin created and login credentials were sent by SMS.'
        : 'Sub-admin created. SMS was skipped/failed, so share the credentials manually once.'
      );
      setForm({ full_name: '', phone: '', password: '', permissions: { ...emptyPermissions } });
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sub-admin.');
    }
  };

  const updateSubAdmin = async (profile: Profile, patch: Partial<Profile>) => {
    setSavingId(profile.id);
    setError('');
    setMessage('');
    try {
      await apiClient(`/api/admin/subadmins/${profile.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setMessage('Sub-admin updated successfully.');
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sub-admin.');
    }
    setSavingId(null);
  };

  const togglePermission = (profile: Profile, permission: AdminPermissionKey) => {
    const permissions = {
      ...emptyPermissions,
      ...(profile.permissions || {}),
      [permission]: !profile.permissions?.[permission],
    };
    updateSubAdmin(profile, { permissions });
  };

  const statCards = [
    { label: 'Registered Users', value: profiles.filter((p) => !p.is_admin).length, icon: Users },
    { label: 'Admin Accounts', value: profiles.filter((p) => p.is_admin).length, icon: ShieldCheck },
    { label: 'Sub-admins', value: profiles.filter((p) => p.role === 'sub_admin').length, icon: UserPlus },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users & Sub-admins</h1>
          <p className="text-sm text-gray-500 mt-1">View registered customers and manage feature-wise admin access.</p>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email, role..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          />
        </div>
      </div>

      {(message || error) && (
        <div className={`rounded-xl p-4 text-sm border ${error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
              <Icon className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-5">
          <UserPlus className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-gray-900">Create Sub-admin</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <input
            value={form.full_name}
            onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
            placeholder="Full name"
            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="01XXXXXXXXX"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="Temporary password"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {PERMISSIONS.map((permission) => (
            <label key={permission} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.permissions[permission]}
                onChange={() => setForm((prev) => ({
                  ...prev,
                  permissions: { ...prev.permissions, [permission]: !prev.permissions[permission] },
                }))}
              />
              {ADMIN_PERMISSION_LABELS[permission]}
            </label>
          ))}
        </div>
        <button
          onClick={createSubAdmin}
          className="mt-4 px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Create & Send SMS
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">Loading users...</div>
      ) : (
        <>
          <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Admin & Sub-admin Accounts</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {admins.map((profile) => (
                <div key={profile.id} className="p-5 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt={profile.full_name} className="w-12 h-12 rounded-xl object-cover" />
                      ) : (
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center font-bold text-blue-700">
                          {profile.full_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-900">{profile.full_name}</p>
                        <p className="text-xs text-gray-500">{profile.phone} {profile.email ? `• ${profile.email}` : ''}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold uppercase">
                            {profile.role === 'sub_admin' ? 'Sub-admin' : 'Admin'}
                          </span>
                          {profile.is_active === false ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px] font-bold">Inactive</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[11px] font-bold">Active</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {profile.role === 'sub_admin' && (
                      <button
                        onClick={() => updateSubAdmin(profile, { is_active: profile.is_active === false })}
                        disabled={savingId === profile.id}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 ${profile.is_active === false ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                      >
                        {profile.is_active === false ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {profile.is_active === false ? 'Activate' : 'Deactivate'}
                      </button>
                    )}
                  </div>
                  {profile.role === 'sub_admin' && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                      {PERMISSIONS.map((permission) => (
                        <button
                          key={permission}
                          disabled={savingId === profile.id}
                          onClick={() => togglePermission(profile, permission)}
                          className={`p-2.5 rounded-xl text-xs font-semibold text-left border ${
                            profile.permissions?.[permission]
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-gray-50 border-gray-100 text-gray-500'
                          }`}
                        >
                          {profile.permissions?.[permission] ? '✓ ' : '+ '}{ADMIN_PERMISSION_LABELS[permission]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {admins.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No admin accounts found.</div>}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Registered Customers</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-5 py-3 text-left">User</th>
                    <th className="px-5 py-3 text-left">Phone</th>
                    <th className="px-5 py-3 text-left">Email</th>
                    <th className="px-5 py-3 text-left">Joined</th>
                    <th className="px-5 py-3 text-left">Photo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {registeredUsers.map((profile) => (
                    <tr key={profile.id}>
                      <td className="px-5 py-3 font-semibold text-gray-900">{profile.full_name}</td>
                      <td className="px-5 py-3 text-gray-600">{profile.phone}</td>
                      <td className="px-5 py-3 text-gray-600">{profile.email || '-'}</td>
                      <td className="px-5 py-3 text-gray-500">{new Date(profile.created_at).toLocaleDateString('en-BD')}</td>
                      <td className="px-5 py-3">
                        {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover" /> : <ImageIcon className="w-4 h-4 text-gray-300" />}
                      </td>
                    </tr>
                  ))}
                  {registeredUsers.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No registered customers found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
