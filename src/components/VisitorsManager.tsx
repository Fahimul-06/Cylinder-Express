import { useEffect, useState } from 'react';
import { RefreshCw, Smartphone, Monitor, Tablet, MapPin, Clock, Trash2, Navigation, Globe2, Eye } from 'lucide-react';

type Visitor = {
  id: string;
  visitor_id: string;
  first_seen: string;
  last_seen: string;
  visits: number;
  last_path: string;
  referrer: string;
  phone_from_link?: string;
  ip_address: string;
  user_agent: string;
  device?: {
    type?: string;
    vendor?: string;
    model?: string;
    browser?: string;
    os?: string;
    is_mobile?: boolean;
    screen?: string;
    language?: string;
    timezone?: string;
    platform?: string;
  };
  gps_location?: {
    allowed?: boolean;
    lat?: number | null;
    lng?: number | null;
    accuracy_meters?: number | null;
    captured_at?: string | null;
  };
  ip_location?: {
    city?: string;
    region?: string;
    country?: string;
    country_code?: string;
    lat?: number | null;
    lng?: number | null;
    isp?: string;
    provider?: string;
    lookup_at?: string | null;
  };
};

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('admin_token') || '';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function mapLink(lat?: number | null, lng?: number | null) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return '';
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function getDeviceIcon(type?: string) {
  if (type === 'Phone') return Smartphone;
  if (type === 'Tablet') return Tablet;
  return Monitor;
}

export function VisitorsManager() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadVisitors = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/visitors?limit=150`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Could not load visitors.');
      setVisitors(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load visitors.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVisitors();
    const interval = window.setInterval(loadVisitors, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const deleteVisitor = async (id: string) => {
    if (!confirm('Delete this visitor record?')) return;
    try {
      const response = await fetch(`${API_BASE}/visitors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) throw new Error('Could not delete visitor.');
      setVisitors((prev) => prev.filter((visitor) => visitor.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete visitor.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">Website Visitors</h1>
          <p className="mt-2 text-gray-400">See which phone/browser opened the portfolio and view location details when available.</p>
        </div>
        <button
          onClick={loadVisitors}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-70"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
        <strong>Exact GPS rule:</strong> A website can only capture exact GPS after the visitor taps “Allow” in the browser location prompt. If they do not allow it, you will see IP-based approximate location only.
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div>}

      {loading && visitors.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-gray-400">Loading visitors...</div>
      ) : visitors.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-gray-400">No visitors tracked yet.</div>
      ) : (
        <div className="space-y-4">
          {visitors.map((visitor) => {
            const DeviceIcon = getDeviceIcon(visitor.device?.type);
            const gpsMap = mapLink(visitor.gps_location?.lat, visitor.gps_location?.lng);
            const ipMap = mapLink(visitor.ip_location?.lat, visitor.ip_location?.lng);
            const isExpanded = expanded === visitor.id;
            const deviceName = [visitor.device?.vendor, visitor.device?.model].filter(Boolean).join(' ') || visitor.device?.type || 'Unknown device';
            const approxLocation = [visitor.ip_location?.city, visitor.ip_location?.region, visitor.ip_location?.country].filter(Boolean).join(', ') || 'Unknown approximate location';

            return (
              <div key={visitor.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
                <div className="p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                        <DeviceIcon size={24} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold text-gray-100">{deviceName}</h2>
                          {visitor.gps_location?.allowed && (
                            <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-300">Exact GPS allowed</span>
                          )}
                          {visitor.phone_from_link && (
                            <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-300">Phone link: {visitor.phone_from_link}</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-400">
                          {visitor.device?.browser || 'Unknown browser'} on {visitor.device?.os || 'Unknown OS'} · {visitor.device?.screen || 'Unknown screen'}
                        </p>
                        <p className="mt-1 text-sm text-gray-400">IP: {visitor.ip_address || 'Unknown'} · Visits: {visitor.visits}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {gpsMap && (
                        <a href={gpsMap} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-green-400">
                          <Navigation size={16} /> Exact map
                        </a>
                      )}
                      {ipMap && (
                        <a href={ipMap} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-slate-800">
                          <Globe2 size={16} /> Approx map
                        </a>
                      )}
                      <button
                        onClick={() => setExpanded(isExpanded ? null : visitor.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-slate-800"
                      >
                        <Eye size={16} /> {isExpanded ? 'Hide' : 'Details'}
                      </button>
                      <button
                        onClick={() => deleteVisitor(visitor.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500"><Clock size={14} /> Last seen</div>
                      <p className="mt-1 text-sm text-gray-200">{formatDate(visitor.last_seen)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500"><MapPin size={14} /> Exact GPS</div>
                      <p className="mt-1 text-sm text-gray-200">
                        {visitor.gps_location?.allowed && typeof visitor.gps_location?.lat === 'number'
                          ? `${visitor.gps_location.lat.toFixed(6)}, ${visitor.gps_location.lng?.toFixed(6)} · ±${Math.round(visitor.gps_location.accuracy_meters || 0)}m`
                          : 'Not allowed yet'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500"><Globe2 size={14} /> Approx location</div>
                      <p className="mt-1 text-sm text-gray-200">{approxLocation}</p>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-800 bg-slate-950/50 p-5">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2 text-sm">
                        <h3 className="font-semibold text-gray-100">Visit details</h3>
                        <p className="text-gray-400"><span className="text-gray-500">First seen:</span> {formatDate(visitor.first_seen)}</p>
                        <p className="text-gray-400"><span className="text-gray-500">Last path:</span> {visitor.last_path || '—'}</p>
                        <p className="text-gray-400"><span className="text-gray-500">Referrer:</span> {visitor.referrer || 'Direct / unknown'}</p>
                        <p className="text-gray-400"><span className="text-gray-500">Language:</span> {visitor.device?.language || '—'}</p>
                        <p className="text-gray-400"><span className="text-gray-500">Timezone:</span> {visitor.device?.timezone || '—'}</p>
                        <p className="text-gray-400"><span className="text-gray-500">Platform:</span> {visitor.device?.platform || '—'}</p>
                      </div>
                      <div className="space-y-2 text-sm">
                        <h3 className="font-semibold text-gray-100">Raw browser user agent</h3>
                        <p className="break-words rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-gray-400">{visitor.user_agent || '—'}</p>
                        <p className="text-xs text-gray-500">Note: iPhone browsers usually hide the exact model. Android often exposes brand/model, but not always.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
