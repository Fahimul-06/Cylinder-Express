import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Address } from '../lib/types';
import { BD_DISTRICTS } from '../lib/constants';
import {
  MapPin, Plus, X, Navigation, Home, Building2,
  Star, Trash2, Edit3, Check, MapPinned
} from 'lucide-react';

const emptyForm = {
  label: 'Home' as 'Home' | 'Office' | 'Other',
  address_line1: '',
  address_line2: '',
  city: 'Dhaka',
  district: 'Dhaka',
  area: '',
  postal_code: '',
};

export default function AddressesPage() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [detectedPlaceName, setDetectedPlaceName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    async function fetch() {
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false });
      setAddresses(data || []);
      setLoading(false);
    }
    fetch();
  }, [user]);

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setDetectedCoords({ lat: latitude, lng: longitude });

        setDetectedPlaceName('');

        // Reverse geocode coordinates into a human-readable place name.
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          if (!res.ok) throw new Error('Unable to resolve place name');
          const data = await res.json();
          const addr = data.address || {};
          const road = addr.road || addr.street || addr.pedestrian || '';
          const neighbourhood = addr.neighbourhood || addr.quarter || addr.suburb || '';
          const area = addr.suburb || addr.city_district || addr.town || addr.village || addr.neighbourhood || '';
          const city = addr.city || addr.town || addr.municipality || addr.county || 'Dhaka';
          const district = addr.state_district || addr.state || addr.region || 'Dhaka';
          const placeName = data.display_name || [road, neighbourhood, area, city, district]
            .filter(Boolean)
            .filter((value, index, values) => values.indexOf(value) === index)
            .join(', ');

          setDetectedPlaceName(placeName || 'Current device location');
          setForm(prev => ({
            ...prev,
            address_line1: road || neighbourhood || area || city || prev.address_line1,
            area: area || prev.area,
            city: city || prev.city,
            district: district || prev.district,
            postal_code: addr.postcode || prev.postal_code,
          }));
        } catch {
          setDetectedPlaceName('Current device location detected');
        }
        setDetectingLocation(false);
      },
      () => setDetectingLocation(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async () => {
    if (!user) {
      setError('You must be logged in to save an address');
      return;
    }
    if (!form.address_line1) {
      setError('Address line 1 is required');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      label: form.label,
      address_line1: form.address_line1,
      address_line2: form.address_line2 || null,
      city: form.city,
      district: form.district || null,
      area: form.area || null,
      postal_code: form.postal_code || null,
      user_id: user.id,
      latitude: detectedCoords?.lat ?? null,
      longitude: detectedCoords?.lng ?? null,
    };

    let result;
    if (editingId) {
      result = await supabase.from('addresses').update(payload).eq('id', editingId).select();
    } else {
      result = await supabase.from('addresses').insert(payload).select();
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false });
    setAddresses(data || []);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setDetectedCoords(null);
    setDetectedPlaceName('');
    setSaving(false);
  };

  const handleEdit = (addr: Address) => {
    setEditingId(addr.id);
    setForm({
      label: addr.label as 'Home' | 'Office' | 'Other',
      address_line1: addr.address_line1,
      address_line2: addr.address_line2 || '',
      city: addr.city,
      district: addr.district || '',
      area: addr.area || '',
      postal_code: addr.postal_code || '',
    });
    setDetectedCoords(addr.latitude && addr.longitude ? { lat: addr.latitude, lng: addr.longitude } : null);
    setDetectedPlaceName([addr.address_line1, addr.area, addr.city, addr.district].filter(Boolean).join(', '));
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('addresses').delete().eq('id', id);
    setAddresses(prev => prev.filter(a => a.id !== id));
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
    await supabase.from('addresses').update({ is_default: true }).eq('id', id);
    setAddresses(prev =>
      prev.map(a => ({ ...a, is_default: a.id === id }))
    );
  };

  const labelIcons = { Home, Office: Building2, Other: MapPinned };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-200 rounded-xl" />
          <div className="h-4 w-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Delivery Addresses</h1>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); setDetectedCoords(null); setDetectedPlaceName(''); setError(null); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" /> Add New
          </button>
        </div>

        {/* Address Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-bold text-lg text-gray-900">
                  {editingId ? 'Edit Address' : 'Add New Address'}
                </h2>
                <button onClick={() => { setShowForm(false); setError(null); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    {error}
                  </div>
                )}
                {/* Location detect */}
                <button
                  onClick={detectLocation}
                  disabled={detectingLocation}
                  className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 rounded-xl hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Navigation className={`w-5 h-5 text-white ${detectingLocation ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-blue-900 text-sm">
                      {detectingLocation ? 'Detecting location...' : 'Share My Location'}
                    </p>
                    <p className="text-xs text-blue-600">Auto-fill address from your GPS location</p>
                  </div>
                </button>

                {detectedCoords && (
                  <div className="flex items-start gap-2 text-green-700 text-sm bg-green-50 p-3 rounded-xl">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Location detected</p>
                      <p className="text-green-600 mt-0.5">{detectedPlaceName || 'Finding the place name...'}</p>
                    </div>
                  </div>
                )}

                {/* Label */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Label</label>
                  <div className="flex gap-2">
                    {(['Home', 'Office', 'Other'] as const).map(lbl => {
                      const Icon = labelIcons[lbl];
                      return (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, label: lbl }))}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            form.label === lbl
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" /> {lbl}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Address Line 1</label>
                  <input
                    value={form.address_line1}
                    onChange={e => setForm(prev => ({ ...prev, address_line1: e.target.value }))}
                    placeholder="House, road, block"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Address Line 2 (Optional)</label>
                  <input
                    value={form.address_line2}
                    onChange={e => setForm(prev => ({ ...prev, address_line2: e.target.value }))}
                    placeholder="Floor, apartment, landmark"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Area</label>
                    <input
                      value={form.area}
                      onChange={e => setForm(prev => ({ ...prev, area: e.target.value }))}
                      placeholder="e.g. Mirpur, Dhanmondi"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                    <input
                      value={form.city}
                      onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">District</label>
                    <select
                      value={form.district}
                      onChange={e => setForm(prev => ({ ...prev, district: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    >
                      {BD_DISTRICTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Postal Code</label>
                    <input
                      value={form.postal_code}
                      onChange={e => setForm(prev => ({ ...prev, postal_code: e.target.value }))}
                      placeholder="e.g. 1216"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving || !form.address_line1}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Address' : 'Save Address'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Address List */}
        {addresses.length > 0 ? (
          <div className="space-y-3">
            {addresses.map(addr => {
              const LabelIcon = labelIcons[addr.label as keyof typeof labelIcons] || MapPinned;
              return (
                <div
                  key={addr.id}
                  className={`bg-white rounded-2xl border-2 p-5 transition-all ${
                    addr.is_default ? 'border-blue-300 bg-blue-50/30' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        addr.is_default ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <LabelIcon className={`w-5 h-5 ${addr.is_default ? 'text-blue-500' : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{addr.label}</span>
                          {addr.is_default && (
                            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                              <Star className="w-3 h-3" /> Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{addr.address_line1}</p>
                        {addr.address_line2 && <p className="text-sm text-gray-500">{addr.address_line2}</p>}
                        <p className="text-xs text-gray-400 mt-1">
                          {addr.area && `${addr.area}, `}{addr.city}{addr.district && `, ${addr.district}`}
                          {addr.postal_code && ` - ${addr.postal_code}`}
                        </p>
                        {addr.latitude && addr.longitude && (
                          <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                            <Navigation className="w-3 h-3" /> Device location saved
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!addr.is_default && (
                        <button
                          onClick={() => handleSetDefault(addr.id)}
                          className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                          title="Set as default"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(addr)}
                        className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(addr.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No saved addresses</h3>
            <p className="text-gray-500 text-sm mb-6">Add a delivery address to get started</p>
            <button
              onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); setDetectedCoords(null); setDetectedPlaceName(''); }}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
            >
              Add Your First Address
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
