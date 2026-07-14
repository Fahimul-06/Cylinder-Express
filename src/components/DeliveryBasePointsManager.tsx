import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Edit, ExternalLink, Loader2, MapPin, Navigation, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { supabase, type DeliveryBasePoint } from '../lib/supabase';

declare global {
  interface Window {
    L?: any;
  }
}

type DeliveryBasePointForm = {
  name: string;
  address: string;
  plus_code: string;
  latitude: string;
  longitude: string;
  contact_person: string;
  phone: string;
  notes: string;
  display_order: number;
  is_active: boolean;
};

const emptyForm: DeliveryBasePointForm = {
  name: '',
  address: '',
  plus_code: '',
  latitude: '',
  longitude: '',
  contact_person: '',
  phone: '',
  notes: '',
  display_order: 0,
  is_active: true,
};

function toForm(point: DeliveryBasePoint): DeliveryBasePointForm {
  return {
    name: point.name || '',
    address: point.address || '',
    plus_code: point.plus_code || '',
    latitude: String(point.latitude ?? ''),
    longitude: String(point.longitude ?? ''),
    contact_person: point.contact_person || '',
    phone: point.phone || '',
    notes: point.notes || '',
    display_order: point.display_order || 0,
    is_active: point.is_active !== false,
  };
}

function googleMapsSearchUrl(point: Partial<DeliveryBasePointForm | DeliveryBasePoint>) {
  const lat = 'latitude' in point ? point.latitude : '';
  const lng = 'longitude' in point ? point.longitude : '';
  const hasCoords = lat !== undefined && lat !== null && String(lat).trim() && lng !== undefined && lng !== null && String(lng).trim();
  const query = hasCoords
    ? `${lat},${lng}`
    : [point.plus_code, point.address, point.name].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || 'delivery base point')}`;
}

function loadLeaflet(): Promise<any> {
  if (window.L) return Promise.resolve(window.L);

  return new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet-css="true"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.setAttribute('data-leaflet-css', 'true');
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-leaflet-js="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.L));
      existingScript.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.setAttribute('data-leaflet-js', 'true');
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

export function DeliveryBasePointsManager() {
  const [points, setPoints] = useState<DeliveryBasePoint[]>([]);
  const [form, setForm] = useState<DeliveryBasePointForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mapError, setMapError] = useState('');
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerLayerRef = useRef<any>(null);

  const activePoints = useMemo(
    () => points.filter((point) => point.is_active !== false && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)),
    [points]
  );

  const loadPoints = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('delivery_base_points')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      setError(error.message || 'Failed to load delivery base points.');
      setPoints([]);
    } else {
      setPoints(data || []);
      setError('');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPoints();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const buildMap = async () => {
      if (!mapElementRef.current) return;

      try {
        const L = await loadLeaflet();
        if (cancelled || !mapElementRef.current) return;

        if (!mapRef.current) {
          mapRef.current = L.map(mapElementRef.current, {
            scrollWheelZoom: true,
            zoomControl: true,
          }).setView([23.8103, 90.4125], 11);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(mapRef.current);
        }

        if (markerLayerRef.current) {
          markerLayerRef.current.clearLayers();
        }

        markerLayerRef.current = L.layerGroup().addTo(mapRef.current);
        const bounds: any[] = [];

        activePoints.forEach((point) => {
          const marker = L.marker([point.latitude, point.longitude]).addTo(markerLayerRef.current);
          marker.bindPopup(`
            <div style="min-width: 220px; font-family: monospace;">
              <strong>${point.name}</strong><br />
              ${point.address ? `${point.address}<br />` : ''}
              ${point.plus_code ? `Plus Code: ${point.plus_code}<br />` : ''}
              ${point.phone ? `Phone: ${point.phone}<br />` : ''}
              <a target="_blank" rel="noreferrer" href="${googleMapsSearchUrl(point)}">Open in Google Maps</a>
            </div>
          `);
          bounds.push([point.latitude, point.longitude]);
        });

        if (bounds.length > 1) {
          mapRef.current.fitBounds(bounds, { padding: [30, 30] });
        } else if (bounds.length === 1) {
          mapRef.current.setView(bounds[0], 15);
        }

        window.setTimeout(() => mapRef.current?.invalidateSize(), 100);
        setMapError('');
      } catch {
        setMapError('Map could not load. Check internet access or CDN blocking. Points are still saved below.');
      }
    };

    buildMap();

    return () => {
      cancelled = true;
    };
  }, [activePoints]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setSuccess('');
  };

  const validateForm = () => {
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);

    if (!form.name.trim()) return 'Base point name is required.';
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'Latitude must be a valid number between -90 and 90.';
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return 'Longitude must be a valid number between -180 and 180.';
    return '';
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      plus_code: form.plus_code.trim(),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      contact_person: form.contact_person.trim(),
      phone: form.phone.trim(),
      notes: form.notes.trim(),
      display_order: Number(form.display_order) || 0,
      is_active: form.is_active,
    };

    const result = editingId
      ? await supabase.from('delivery_base_points').update(payload).eq('id', editingId)
      : await supabase.from('delivery_base_points').insert(payload);

    setSaving(false);

    if (result.error) {
      setError(result.error.message || 'Failed to save delivery base point.');
      return;
    }

    setSuccess(editingId ? 'Delivery base point updated.' : 'Delivery base point added.');
    resetForm();
    await loadPoints();
  };

  const handleEdit = (point: DeliveryBasePoint) => {
    setForm(toForm(point));
    setEditingId(point.id);
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (point: DeliveryBasePoint) => {
    if (!confirm(`Delete delivery base point "${point.name}"?`)) return;
    const { error } = await supabase.from('delivery_base_points').delete().eq('id', point.id);
    if (error) {
      setError(error.message || 'Failed to delete delivery base point.');
      return;
    }
    if (editingId === point.id) resetForm();
    setSuccess('Delivery base point deleted.');
    await loadPoints();
  };

  const copyCoordinates = (point: DeliveryBasePoint) => {
    navigator.clipboard?.writeText(`${point.latitude}, ${point.longitude}`);
    setSuccess('Coordinates copied.');
  };

  return (
    <div className="space-y-8">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
              <MapPin className="text-amber-400" size={24} />
              Delivery Base Points
            </h2>
            <p className="text-gray-400 mt-2">
              Add delivery bases with address/plus code and coordinates, then view all active points on the map.
            </p>
          </div>
          {editingId && (
            <button onClick={resetForm} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-gray-300 rounded-lg hover:bg-slate-700">
              <X size={16} /> Cancel Edit
            </button>
          )}
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">{success}</div>}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Base Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Example: Mirpur Delivery Base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Plus Code</label>
            <input
              value={form.plus_code}
              onChange={(e) => setForm({ ...form, plus_code: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Example: Q9C7+45 Dhaka"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">Address</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Full delivery base address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Latitude *</label>
            <input
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="23.8103"
              inputMode="decimal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Longitude *</label>
            <input
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="90.4125"
              inputMode="decimal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Contact Person</label>
            <input
              value={form.contact_person}
              onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Manager name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="01XXXXXXXXX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Display Order</label>
            <input
              type="number"
              value={form.display_order}
              onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <label className="flex items-center gap-3 mt-8 text-gray-300">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
            />
            Active on map
          </label>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Internal notes, delivery coverage, staff instructions, etc."
            />
          </div>

          <div className="md:col-span-2 flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 transition-all"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : editingId ? <Save size={18} /> : <Plus size={18} />}
              {editingId ? 'Update Base Point' : 'Add Base Point'}
            </button>
            <a
              href={googleMapsSearchUrl(form)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 border border-slate-700 text-gray-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Search size={18} /> Search Address / Plus Code
            </a>
          </div>
        </form>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-100">Interactive Map</h3>
            <p className="text-sm text-gray-400">Showing active delivery base points.</p>
          </div>
          <span className="inline-flex items-center gap-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
            <Navigation size={14} /> {activePoints.length} active point{activePoints.length === 1 ? '' : 's'}
          </span>
        </div>
        {mapError && <div className="m-6 p-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 rounded-lg text-sm">{mapError}</div>}
        <div ref={mapElementRef} className="h-[420px] w-full bg-slate-800" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <h3 className="text-lg font-bold text-gray-100">All Delivery Base Points</h3>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center text-gray-400">
            <Loader2 className="animate-spin mr-2" /> Loading points...
          </div>
        ) : points.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No delivery base points added yet.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {points.map((point) => (
              <div key={point.id} className="p-5 hover:bg-slate-800/50 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="text-gray-100 font-semibold text-lg">{point.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs border ${point.is_active ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-slate-700 text-gray-400 border-slate-600'}`}>
                        {point.is_active ? 'Active' : 'Hidden'}
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs bg-slate-800 text-gray-400 border border-slate-700">
                        Order {point.display_order}
                      </span>
                    </div>
                    {point.address && <p className="text-gray-300 mb-1">{point.address}</p>}
                    {point.plus_code && <p className="text-gray-400 text-sm mb-1">Plus Code: {point.plus_code}</p>}
                    <p className="text-gray-500 text-sm mb-1">Lat/Lng: {point.latitude}, {point.longitude}</p>
                    {(point.contact_person || point.phone) && (
                      <p className="text-gray-400 text-sm mb-1">
                        {point.contact_person}{point.contact_person && point.phone ? ' · ' : ''}{point.phone}
                      </p>
                    )}
                    {point.notes && <p className="text-gray-500 text-sm mt-2 whitespace-pre-wrap">{point.notes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      onClick={() => copyCoordinates(point)}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 text-gray-300 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <Navigation size={16} /> Copy
                    </button>
                    <a
                      href={googleMapsSearchUrl(point)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 text-gray-300 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <ExternalLink size={16} /> Map
                    </a>
                    <button
                      onClick={() => handleEdit(point)}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-colors"
                    >
                      <Edit size={16} /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(point)}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
