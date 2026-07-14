import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Plus, Pencil, Trash2, Save, X, Navigation, RefreshCw } from 'lucide-react';
import { apiClient } from '../../lib/supabase';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

type BasePoint = { id: string; name: string; address: string; latitude: number; longitude: number; notes?: string; is_active: boolean };
type FormState = { name: string; address: string; latitude: string; longitude: string; notes: string; is_active: boolean };
const emptyForm: FormState = { name: '', address: '', latitude: '', longitude: '', notes: '', is_active: true };


function loadGoogleMaps() {
  return new Promise<void>((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) return reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'));
    if (window.google?.maps) return resolve();
    const existing = document.getElementById('google-maps-script');
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true; script.defer = true; script.onload = () => resolve(); script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

export default function AdminBasePoints() {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const pickerMarker = useRef<any>(null);
  const [points, setPoints] = useState<BasePoint[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchPoints = useCallback(async () => {
    try { const result = await apiClient<{data: BasePoint[]}>('/api/admin/delivery-base-points'); setPoints(result.data || []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load base points'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPoints(); }, [fetchPoints]);
  useEffect(() => { loadGoogleMaps().then(() => {
    if (!mapEl.current || map.current) return;
    const google = window.google as any;
    map.current = new google.maps.Map(mapEl.current, { center: { lat: 23.8103, lng: 90.4125 }, zoom: 11, mapTypeControl: false, streetViewControl: false });
    map.current.addListener('click', (event: any) => {
      const lat = event.latLng.lat(); const lng = event.latLng.lng();
      setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
      if (pickerMarker.current) pickerMarker.current.setMap(null);
      pickerMarker.current = new google.maps.Marker({ position: { lat, lng }, map: map.current, title: 'Selected base point' });
      new google.maps.Geocoder().geocode({ location: { lat, lng } }, (results: any[], status: string) => {
        if (status === 'OK' && results?.[0]) setForm((f) => ({ ...f, address: f.address || results[0].formatted_address }));
      });
    });
  }).catch((e) => setError(e.message)); }, []);

  useEffect(() => {
    if (!map.current || !window.google?.maps) return;
    markers.current.forEach((m) => m.setMap(null)); markers.current = [];
    const google = window.google as any;
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => {
      const marker = new google.maps.Marker({ position: { lat: p.latitude, lng: p.longitude }, map: map.current, title: p.name, opacity: p.is_active ? 1 : .5 });
      const info = new google.maps.InfoWindow({ content: `<div style="min-width:180px"><strong>${p.name}</strong><br/>${p.address}<br/><small>${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}</small></div>` });
      marker.addListener('click', () => info.open({ anchor: marker, map: map.current })); markers.current.push(marker); bounds.extend(marker.getPosition());
    });
    if (points.length) map.current.fitBounds(bounds);
  }, [points]);

  const startEdit = (p: BasePoint) => { setEditingId(p.id); setForm({ name:p.name,address:p.address,latitude:String(p.latitude),longitude:String(p.longitude),notes:p.notes||'',is_active:p.is_active }); setShowForm(true); map.current?.panTo({lat:p.latitude,lng:p.longitude}); map.current?.setZoom(15); };
  const reset = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); if (pickerMarker.current) { pickerMarker.current.setMap(null); pickerMarker.current=null; } };
  const save = async () => {
    setSaving(true); setError('');
    try {
      const body = { ...form, latitude:Number(form.latitude), longitude:Number(form.longitude) };
      if (editingId) await apiClient(`/api/admin/delivery-base-points/${editingId}`, { method:'PATCH', body:JSON.stringify(body) });
      else await apiClient('/api/admin/delivery-base-points', { method:'POST', body:JSON.stringify(body) });
      await fetchPoints(); reset();
    } catch(e) { setError(e instanceof Error ? e.message : 'Save failed'); } finally { setSaving(false); }
  };
  const remove = async (p: BasePoint) => { if (!confirm(`Delete ${p.name}?`)) return; try { await apiClient(`/api/admin/delivery-base-points/${p.id}`, {method:'DELETE'}); await fetchPoints(); } catch(e) { setError(e instanceof Error ? e.message : 'Delete failed'); } };
  const useDevice = () => navigator.geolocation.getCurrentPosition((pos) => setForm((f)=>({...f,latitude:pos.coords.latitude.toFixed(6),longitude:pos.coords.longitude.toFixed(6)})), ()=>setError('Could not access device location.'));

  return <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-900">Delivery Base Points</h1><p className="text-sm text-gray-500">Create, edit and view all operating bases on the map.</p></div><div className="flex gap-2"><button onClick={fetchPoints} className="p-2.5 border rounded-xl"><RefreshCw className="w-4 h-4"/></button><button onClick={()=>setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold"><Plus className="w-4 h-4"/> Add Base Point</button></div></div>
    {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
    {showForm && <div className="bg-white border rounded-2xl p-5 grid md:grid-cols-2 gap-4">
      <input className="border rounded-xl px-3 py-2.5" placeholder="Base point name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <input className="border rounded-xl px-3 py-2.5" placeholder="Full address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/>
      <input className="border rounded-xl px-3 py-2.5" placeholder="Latitude" type="number" step="any" value={form.latitude} onChange={e=>setForm({...form,latitude:e.target.value})}/>
      <input className="border rounded-xl px-3 py-2.5" placeholder="Longitude" type="number" step="any" value={form.longitude} onChange={e=>setForm({...form,longitude:e.target.value})}/>
      <textarea className="border rounded-xl px-3 py-2.5 md:col-span-2" placeholder="Notes (optional)" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Active base point</label>
      <div className="flex justify-end gap-2"><button onClick={useDevice} className="inline-flex items-center gap-2 px-3 py-2 border rounded-xl"><Navigation className="w-4 h-4"/>Use device location</button><button onClick={reset} className="px-3 py-2 border rounded-xl"><X className="w-4 h-4"/></button><button disabled={saving} onClick={save} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl"><Save className="w-4 h-4"/>{saving?'Saving...':'Save'}</button></div>
      <p className="md:col-span-2 text-xs text-gray-500">Tip: click anywhere on the map to set coordinates and automatically suggest an address.</p>
    </div>}
    <div className="bg-white border rounded-2xl overflow-hidden"><div ref={mapEl} className="h-[460px] w-full"/></div>
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{loading?<p>Loading...</p>:points.map(p=><div key={p.id} className="bg-white border rounded-2xl p-4"><div className="flex justify-between gap-3"><div><div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-600"/><h3 className="font-bold">{p.name}</h3></div><p className="text-sm text-gray-600 mt-2">{p.address}</p><p className="text-xs text-gray-400 mt-1">{p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}</p><span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${p.is_active?'bg-green-50 text-green-700':'bg-gray-100 text-gray-600'}`}>{p.is_active?'Active':'Inactive'}</span></div><div className="flex gap-1"><button onClick={()=>startEdit(p)} className="p-2 hover:bg-gray-100 rounded-lg"><Pencil className="w-4 h-4"/></button><button onClick={()=>remove(p)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 className="w-4 h-4"/></button></div></div></div>)}</div>
  </div>;
}
