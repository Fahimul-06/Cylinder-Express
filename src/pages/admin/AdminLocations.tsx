import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { MapPin, Users, RefreshCw, Navigation } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = 'AIzaSyB6r1J92vQSRI5o-SdQ9D16MBBwPyzCz9o';

interface LocationRecord {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  is_sharing: boolean;
  updated_at: string;
  profile?: { full_name: string; phone: string };
}

declare global {
  interface Window {
    google: typeof google;
    initMap: () => void;
  }
}

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(); return; }
    const existing = document.getElementById('google-maps-script');
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

export default function AdminLocations() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapsReady, setMapsReady] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchLocations = useCallback(async () => {
    const { data: locs } = await supabase
      .from('customer_locations')
      .select('*')
      .eq('is_sharing', true);

    if (!locs || locs.length === 0) { setLocations([]); setLoading(false); return; }

    const userIds = [...new Set(locs.map((l: LocationRecord) => l.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone')
      .in('user_id', userIds);

    const profileMap: Record<string, { full_name: string; phone: string }> = {};
    if (profiles) for (const p of profiles) profileMap[p.user_id] = p;

    const enriched: LocationRecord[] = locs.map((l: LocationRecord) => ({
      ...l,
      profile: profileMap[l.user_id],
    }));

    setLocations(enriched);
    setLastRefresh(new Date());
    setLoading(false);
    return enriched;
  }, []);

  // Initialize map
  useEffect(() => {
    loadGoogleMaps().then(() => setMapsReady(true));
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 23.8103, lng: 90.4125 }, // Dhaka
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    });
  }, [mapsReady]);

  // Update markers when locations change
  useEffect(() => {
    if (!mapInstanceRef.current || !mapsReady) return;

    const activeIds = new Set(locations.map(l => l.user_id));

    // Remove stale markers
    markersRef.current.forEach((marker, uid) => {
      if (!activeIds.has(uid)) {
        marker.setMap(null);
        markersRef.current.delete(uid);
      }
    });

    // Add/update markers
    locations.forEach(loc => {
      const pos = { lat: loc.latitude, lng: loc.longitude };
      const title = loc.profile?.full_name || 'Customer';
      const existing = markersRef.current.get(loc.user_id);
      if (existing) {
        existing.setPosition(pos);
      } else {
        const marker = new window.google.maps.Marker({
          position: pos,
          map: mapInstanceRef.current!,
          title,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#2563eb',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="font-family:sans-serif;padding:4px 2px;min-width:140px">
              <p style="font-weight:600;margin:0 0 2px;font-size:13px">${title}</p>
              <p style="color:#6b7280;margin:0;font-size:11px">${loc.profile?.phone || ''}</p>
              <p style="color:#2563eb;margin:4px 0 0;font-size:11px">Live sharing</p>
            </div>
          `,
        });

        marker.addListener('click', () => infoWindow.open(mapInstanceRef.current!, marker));
        markersRef.current.set(loc.user_id, marker);
      }
    });

    // If locations exist, fit bounds
    if (locations.length > 0 && mapInstanceRef.current) {
      const bounds = new window.google.maps.LatLngBounds();
      locations.forEach(l => bounds.extend({ lat: l.latitude, lng: l.longitude }));
      mapInstanceRef.current.fitBounds(bounds);
      if (locations.length === 1) mapInstanceRef.current.setZoom(15);
    }
  }, [locations, mapsReady]);

  // Initial fetch + poll every 15s
  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 15000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('customer_locations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_locations' }, () => {
        fetchLocations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLocations]);

  const activeCount = locations.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-screen flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Customer Locations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCount} customer{activeCount !== 1 ? 's' : ''} sharing location
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Updated {lastRefresh.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            onClick={fetchLocations}
            className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 bg-gray-100 rounded-2xl overflow-hidden relative min-h-[400px]">
          <div ref={mapRef} className="w-full h-full" />
          {!mapsReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="animate-pulse flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-blue-200 rounded-xl" />
                <p className="text-sm text-gray-400">Loading map...</p>
              </div>
            </div>
          )}
          {mapsReady && activeCount === 0 && !loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MapPin className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">No customers sharing location</p>
                <p className="text-sm text-gray-400 mt-1">Customers can share their location from the Orders page</p>
              </div>
            </div>
          )}
        </div>

        {/* Customer list */}
        <div className="lg:w-72 flex flex-col gap-2 overflow-y-auto">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))
          ) : activeCount === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
              <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No active shares</p>
            </div>
          ) : (
            locations.map(loc => {
              const age = Math.round((Date.now() - new Date(loc.updated_at).getTime()) / 1000);
              const ageStr = age < 60 ? `${age}s ago` : `${Math.round(age / 60)}m ago`;
              return (
                <div
                  key={loc.user_id}
                  className="bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all"
                  onClick={() => {
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.panTo({ lat: loc.latitude, lng: loc.longitude });
                      mapInstanceRef.current.setZoom(16);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Navigation className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">
                        {loc.profile?.full_name || 'Customer'}
                      </p>
                      <p className="text-xs text-gray-500">{loc.profile?.phone || ''}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs text-green-700">{ageStr}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400 font-mono">
                    {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
