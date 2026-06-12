import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { MapPin, Users, RefreshCw, Navigation, Route, ShoppingBag, Clock } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

interface LocationPoint {
  id: string;
  user_id: string;
  order_id: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recorded_at: string;
}

interface ActiveOrder {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  total_amount?: number;
}

interface LocationRecord {
  id: string;
  user_id: string;
  active_order_id?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  is_sharing: boolean;
  updated_at: string;
  profile?: { full_name: string; phone: string };
  activeOrder?: ActiveOrder;
  route?: LocationPoint[];
}

type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => any;
    Marker: new (options: Record<string, unknown>) => any;
    Polyline: new (options: Record<string, unknown>) => any;
    InfoWindow: new (options: Record<string, unknown>) => any;
    LatLngBounds: new () => any;
    SymbolPath: { CIRCLE: unknown; FORWARD_CLOSED_ARROW: unknown };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsApi;
  }
}

const ACTIVE_ORDER_STATUSES = ['pending', 'confirmed', 'processing'];
const STOP_TRACKING_STATUSES = ['delivered', 'completed', 'cancelled'];

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) {
      reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY environment variable'));
      return;
    }
    if (window.google?.maps) { resolve(); return; }
    const existing = document.getElementById('google-maps-script');
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

export default function AdminLocations() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const polylinesRef = useRef<Map<string, any>>(new Map());
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapsReady, setMapsReady] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [mapError, setMapError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    setLoading(prev => locations.length === 0 ? true : prev);

    const { data: activeOrdersData } = await supabase
      .from('orders')
      .select('id, user_id, status, created_at, total_amount')
      .in('status', ACTIVE_ORDER_STATUSES);

    const activeOrders: ActiveOrder[] = activeOrdersData || [];
    const activeUserIds = [...new Set(activeOrders.map(order => order.user_id).filter(Boolean))];

    if (activeUserIds.length === 0) {
      setLocations([]);
      setLoading(false);
      setLastRefresh(new Date());
      return [];
    }

    const [{ data: locs }, { data: profiles }, { data: points }] = await Promise.all([
      supabase
        .from('customer_locations')
        .select('*')
        .eq('is_sharing', true)
        .in('user_id', activeUserIds),
      supabase
        .from('profiles')
        .select('user_id, full_name, phone')
        .in('user_id', activeUserIds),
      supabase
        .from('customer_location_points')
        .select('*')
        .in('user_id', activeUserIds)
        .order('recorded_at', { ascending: true }),
    ]);

    if (!locs || locs.length === 0) {
      setLocations([]);
      setLoading(false);
      setLastRefresh(new Date());
      return [];
    }

    const profileMap: Record<string, { full_name: string; phone: string }> = {};
    if (profiles) for (const p of profiles) profileMap[p.user_id] = p;

    const latestActiveOrderByUser = new Map<string, ActiveOrder>();
    for (const order of activeOrders) {
      const existing = latestActiveOrderByUser.get(order.user_id);
      if (!existing || new Date(order.created_at).getTime() > new Date(existing.created_at).getTime()) {
        latestActiveOrderByUser.set(order.user_id, order);
      }
    }

    const pointMap = new Map<string, LocationPoint[]>();
    for (const rawPoint of points || []) {
      const point = rawPoint as LocationPoint;
      const activeOrder = latestActiveOrderByUser.get(point.user_id);
      if (!activeOrder || (point.order_id && point.order_id !== activeOrder.id)) continue;
      const list = pointMap.get(point.user_id) || [];
      list.push(point);
      pointMap.set(point.user_id, list.slice(-100));
    }

    const enriched: LocationRecord[] = (locs as LocationRecord[])
      .map((loc) => {
        const activeOrder = latestActiveOrderByUser.get(loc.user_id);
        if (!activeOrder || STOP_TRACKING_STATUSES.includes(activeOrder.status)) return null;
        const route = pointMap.get(loc.user_id) || [];
        return {
          ...loc,
          profile: profileMap[loc.user_id],
          activeOrder,
          route,
        };
      })
      .filter(Boolean) as LocationRecord[];

    setLocations(enriched);
    setLastRefresh(new Date());
    setLoading(false);
    return enriched;
  }, [locations.length]);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        setMapError(null);
        setMapsReady(true);
      })
      .catch((error) => {
        console.error(error);
        setMapError(error instanceof Error ? error.message : 'Failed to load Google Maps');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = new window.google!.maps.Map(mapRef.current, {
      center: { lat: 23.8103, lng: 90.4125 },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    });
  }, [mapsReady]);

  useEffect(() => {
    if (!mapInstanceRef.current || !mapsReady) return;

    const activeIds = new Set(locations.map(l => l.user_id));

    markersRef.current.forEach((marker, uid) => {
      if (!activeIds.has(uid)) {
        marker.setMap(null);
        markersRef.current.delete(uid);
      }
    });

    polylinesRef.current.forEach((polyline, uid) => {
      if (!activeIds.has(uid)) {
        polyline.setMap(null);
        polylinesRef.current.delete(uid);
      }
    });

    locations.forEach(loc => {
      const pos = { lat: loc.latitude, lng: loc.longitude };
      const title = loc.profile?.full_name || 'Customer';
      const routePath = [...(loc.route || []).map(point => ({ lat: point.latitude, lng: point.longitude })), pos]
        .filter((point, index, arr) => index === 0 || point.lat !== arr[index - 1].lat || point.lng !== arr[index - 1].lng);

      const existingPolyline = polylinesRef.current.get(loc.user_id);
      if (existingPolyline) {
        existingPolyline.setPath(routePath);
      } else if (routePath.length >= 2) {
        const polyline = new window.google!.maps.Polyline({
          path: routePath,
          geodesic: true,
          strokeColor: '#2563eb',
          strokeOpacity: 0.85,
          strokeWeight: 4,
          icons: [{
            icon: { path: window.google!.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: '#2563eb' },
            offset: '100%',
          }],
          map: mapInstanceRef.current!,
        });
        polylinesRef.current.set(loc.user_id, polyline);
      }

      const existing = markersRef.current.get(loc.user_id);
      if (existing) {
        existing.setPosition(pos);
      } else {
        const marker = new window.google!.maps.Marker({
          position: pos,
          map: mapInstanceRef.current!,
          title,
          icon: {
            path: window.google!.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#2563eb',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        const infoWindow = new window.google!.maps.InfoWindow({
          content: `
            <div style="font-family:sans-serif;padding:4px 2px;min-width:190px">
              <p style="font-weight:700;margin:0 0 2px;font-size:13px">${title}</p>
              <p style="color:#6b7280;margin:0;font-size:11px">${loc.profile?.phone || ''}</p>
              <p style="color:#2563eb;margin:6px 0 0;font-size:11px;font-weight:600">Order #${loc.activeOrder?.id?.slice(0, 8) || 'active'}</p>
              <p style="color:#16a34a;margin:3px 0 0;font-size:11px">Live route tracking</p>
            </div>
          `,
        });

        marker.addListener('click', () => infoWindow.open(mapInstanceRef.current!, marker));
        markersRef.current.set(loc.user_id, marker);
      }
    });

    if (locations.length > 0 && mapInstanceRef.current) {
      const bounds = new window.google!.maps.LatLngBounds();
      locations.forEach(location => {
        bounds.extend({ lat: location.latitude, lng: location.longitude });
        (location.route || []).forEach(point => bounds.extend({ lat: point.latitude, lng: point.longitude }));
      });
      mapInstanceRef.current.fitBounds(bounds);
      if (locations.length === 1) mapInstanceRef.current.setZoom(15);
    }
  }, [locations, mapsReady]);

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 10000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

  const activeCount = locations.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-screen flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Order Route Tracking</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCount} active ordered customer{activeCount !== 1 ? 's' : ''} sharing live route
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
        <div className="flex-1 bg-gray-100 rounded-2xl overflow-hidden relative min-h-[400px]">
          <div ref={mapRef} className="w-full h-full" />
          {!mapsReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 p-6">
              {mapError ? (
                <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-sm border border-red-100">
                  <MapPin className="w-10 h-10 text-red-400 mx-auto mb-3" />
                  <p className="font-semibold text-gray-900">Google Map could not load</p>
                  <p className="text-sm text-gray-500 mt-2">{mapError}</p>
                  <p className="text-xs text-gray-400 mt-3">Check VITE_GOOGLE_MAPS_API_KEY on the Render frontend service, enable Maps JavaScript API, allow your Render domain, then redeploy the frontend.</p>
                </div>
              ) : (
                <div className="animate-pulse flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-blue-200 rounded-xl" />
                  <p className="text-sm text-gray-400">Loading map...</p>
                </div>
              )}
            </div>
          )}
          {mapsReady && activeCount === 0 && !loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
              <div className="text-center max-w-sm px-6">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MapPin className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-700 font-semibold">No active order live routes</p>
                <p className="text-sm text-gray-400 mt-1">Only customers with pending, confirmed, or processing orders appear here. Delivered/cancelled orders are automatically removed.</p>
              </div>
            </div>
          )}
        </div>

        <div className="lg:w-80 flex flex-col gap-2 overflow-y-auto">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))
          ) : activeCount === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
              <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No active live routes</p>
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
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-gray-900 truncate">
                        {loc.profile?.full_name || 'Customer'}
                      </p>
                      <p className="text-xs text-gray-500">{loc.profile?.phone || ''}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
                          <ShoppingBag className="w-3 h-3" /> #{loc.activeOrder?.id?.slice(0, 8)}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700 text-[11px] font-semibold">
                          <Clock className="w-3 h-3" /> {ageStr}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-gray-50 p-2">
                      <p className="text-gray-400">Route points</p>
                      <p className="font-semibold text-gray-900 flex items-center gap-1"><Route className="w-3 h-3" /> {(loc.route || []).length}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-2">
                      <p className="text-gray-400">Status</p>
                      <p className="font-semibold text-gray-900 capitalize">{loc.activeOrder?.status || 'Active'}</p>
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
