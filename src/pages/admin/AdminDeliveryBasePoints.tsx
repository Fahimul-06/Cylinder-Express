import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Edit3, MapPin, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

type BasePoint = {
  id: string;
  name: string;
  address: string;
  plus_code?: string | null;
  latitude: number;
  longitude: number;
  is_active: boolean;
};


function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) return reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'));
    if (window.google?.maps) return resolve();
    const existing = document.getElementById('google-maps-script');
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true; script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

const emptyForm = { name: '', address: '', plus_code: '', latitude: '', longitude: '', is_active: true };

export default function AdminDeliveryBasePoints() {
  const { user } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [points, setPoints] = useState<BasePoint[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mapsReady, setMapsReady] = useState(false);

  const fetchPoints = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('delivery_base_points').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message); else setPoints((data || []) as BasePoint[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPoints(); }, [fetchPoints]);
  useEffect(() => { loadGoogleMaps().then(() => setMapsReady(true)).catch(e => setError(e.message)); }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapInstance.current) return;
    mapInstance.current = new (window.google as any).maps.Map(mapRef.current, {
      center: { lat: 23.8103, lng: 90.4125 }, zoom: 11, mapTypeControl: false, streetViewControl: false,
    });
    mapInstance.current.addListener('click', (event: any) => {
      setForm(prev => ({ ...prev, latitude: event.latLng.lat().toFixed(7), longitude: event.latLng.lng().toFixed(7) }));
    });
  }, [mapsReady]);

  useEffect(() => {
    if (!mapInstance.current || !mapsReady) return;
    markers.current.forEach(marker => marker.setMap(null)); markers.current = [];
    const bounds = new (window.google as any).maps.LatLngBounds();
    points.forEach(point => {
      const pos = { lat: Number(point.latitude), lng: Number(point.longitude) };
      const marker = new (window.google as any).maps.Marker({ map: mapInstance.current, position: pos, title: point.name });
      const info = new (window.google as any).maps.InfoWindow({ content: `<strong>${point.name}</strong><br>${point.address}${point.plus_code ? `<br>Plus Code: ${point.plus_code}` : ''}` });
      marker.addListener('click', () => info.open({ map: mapInstance.current, anchor: marker }));
      markers.current.push(marker); bounds.extend(pos);
    });
    if (points.length) mapInstance.current.fitBounds(bounds);
  }, [points, mapsReady]);

  const resolveLocation = async () => {
    if (!window.google?.maps) return;
    const query = [form.plus_code, form.address].filter(Boolean).join(' ');
    if (!query) return setError('Enter an address or Plus Code first.');
    const geocoder = new (window.google as any).maps.Geocoder();
    geocoder.geocode({ address: query }, (results: any[], status: string) => {
      if (status !== 'OK' || !results?.[0]) return setError('Could not find that address or Plus Code.');
      const result = results[0]; const loc = result.geometry.location;
      setForm(prev => ({ ...prev, address: prev.address || result.formatted_address, latitude: loc.lat().toFixed(7), longitude: loc.lng().toFixed(7) }));
      mapInstance.current?.setCenter({ lat: loc.lat(), lng: loc.lng() }); mapInstance.current?.setZoom(16); setError('');
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    const latitude = Number(form.latitude), longitude = Number(form.longitude);
    if (!form.name.trim() || !form.address.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return setError('Name, address and valid map coordinates are required.');
    setSaving(true);
    const payload = { name: form.name.trim(), address: form.address.trim(), plus_code: form.plus_code.trim() || null, latitude, longitude, is_active: form.is_active, created_by: user?.id };
    const result = editingId
      ? await supabase.from('delivery_base_points').update(payload).eq('id', editingId).select().single()
      : await supabase.from('delivery_base_points').insert(payload).select().single();
    if (result.error) setError(result.error.message); else { setForm(emptyForm); setEditingId(null); await fetchPoints(); }
    setSaving(false);
  };

  const edit = (point: BasePoint) => {
    setEditingId(point.id);
    setForm({ name: point.name, address: point.address, plus_code: point.plus_code || '', latitude: String(point.latitude), longitude: String(point.longitude), is_active: point.is_active !== false });
    mapInstance.current?.setCenter({ lat: point.latitude, lng: point.longitude }); mapInstance.current?.setZoom(16);
  };

  const remove = async (point: BasePoint) => {
    if (!confirm(`Delete delivery base point “${point.name}”?`)) return;
    const { error } = await supabase.from('delivery_base_points').delete().eq('id', point.id);
    if (error) setError(error.message); else await fetchPoints();
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Delivery Base Points</h1><p className="text-sm text-gray-500">Add, edit and view delivery hubs by address or Plus Code.</p></div>
        <button onClick={fetchPoints} className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-white text-sm font-semibold"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid xl:grid-cols-[380px_1fr] gap-6">
        <form onSubmit={submit} className="bg-white border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex justify-between"><h2 className="font-bold">{editingId ? 'Edit Base Point' : 'Add Base Point'}</h2>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}><X className="w-5 h-5" /></button>}</div>
          <input className="w-full border rounded-xl px-3 py-2.5" placeholder="Base point name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <textarea className="w-full border rounded-xl px-3 py-2.5" placeholder="Full address" rows={3} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          <input className="w-full border rounded-xl px-3 py-2.5 uppercase" placeholder="Plus Code (optional)" value={form.plus_code} onChange={e => setForm({ ...form, plus_code: e.target.value.toUpperCase() })} />
          <button type="button" onClick={resolveLocation} className="w-full flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 font-semibold text-sm"><MapPin className="w-4 h-4" /> Find on Map</button>
          <div className="grid grid-cols-2 gap-3"><input className="border rounded-xl px-3 py-2.5" placeholder="Latitude" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} /><input className="border rounded-xl px-3 py-2.5" placeholder="Longitude" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active base point</label>
          <button disabled={saving} className="w-full flex justify-center items-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-60">{editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Base Point'}</button>
          <p className="text-xs text-gray-500">Tip: click anywhere on the map to set coordinates manually.</p>
        </form>

        <div className="space-y-4">
          <div ref={mapRef} className="h-[480px] bg-gray-100 border rounded-2xl overflow-hidden shadow-sm" />
          <div className="bg-white border rounded-2xl overflow-hidden">
            <div className="p-4 border-b font-bold">Managed Points ({points.length})</div>
            {loading ? <div className="p-6 text-gray-500">Loading...</div> : points.length === 0 ? <div className="p-6 text-gray-500">No delivery base points added yet.</div> : points.map(point => (
              <div key={point.id} className="p-4 border-b last:border-0 flex gap-3 justify-between">
                <div><div className="font-semibold flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600" />{point.name}<span className={`text-[10px] px-2 py-0.5 rounded-full ${point.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{point.is_active ? 'Active' : 'Inactive'}</span></div><p className="text-sm text-gray-600 mt-1">{point.address}</p>{point.plus_code && <p className="text-xs text-gray-500 mt-1">Plus Code: {point.plus_code}</p>}</div>
                <div className="flex gap-2"><button onClick={() => edit(point)} className="p-2 rounded-lg bg-blue-50 text-blue-700"><Edit3 className="w-4 h-4" /></button><button onClick={() => remove(point)} className="p-2 rounded-lg bg-red-50 text-red-700"><Trash2 className="w-4 h-4" /></button></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
