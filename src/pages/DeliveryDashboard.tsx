import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Order, Address, Profile, LocationPoint } from '../lib/types';
import { LogOut, MapPin, Navigation, RefreshCw, Route, Truck, User, Phone, PackageCheck, Headphones, CheckCircle2, History, Wallet } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import LanguageToggle from '../components/LanguageToggle';
import { useLanguage } from '../contexts/LanguageContext';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const ACTIVE_ORDER_STATUSES = ['pending', 'confirmed', 'processing'];
const CALL_CENTER_NUMBERS = ['+8801967517077', '+8801409472939'];

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
  interface Window { google?: GoogleMapsApi; }
}

interface EnrichedOrder extends Order {
  customer?: Profile;
  address?: Address;
  customerLocation?: { latitude: number; longitude: number; updated_at: string } | null;
  customerRoute?: LocationPoint[];
}

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) return reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'));
    if (window.google?.maps) return resolve();
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

export default function DeliveryDashboard() {
  const { user, profile, signOut } = useAuth();
  const { t } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const [orders, setOrders] = useState<EnrichedOrder[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<EnrichedOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<{ latitude: number; longitude: number; accuracy?: number | null } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [markingDelivered, setMarkingDelivered] = useState(false);
  const [acceptingDelivery, setAcceptingDelivery] = useState(false);

  const selectedOrder = useMemo(() => orders.find((o) => o.id === selectedOrderId) || orders[0] || null, [orders, selectedOrderId]);
  const deliveredTotal = useMemo(() => deliveredOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0), [deliveredOrders]);

  const saveDeliveryLocation = useCallback(async (position: GeolocationPosition) => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      is_sharing: true,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDeliveryLocation(payload);
    setSharing(true);
    await supabase.from('delivery_locations').upsert(payload);
    await supabase.from('delivery_location_points').insert({
      user_id: user.id,
      order_id: selectedOrder?.id || null,
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy,
      recorded_at: new Date().toISOString(),
    });
  }, [user, selectedOrder?.id]);

  const startSharing = () => {
    setMessage('');
    if (watchIdRef.current !== null) {
      setSharing(true);
      return;
    }
    if (!navigator.geolocation) {
      setMessage(t('delivery.locationUnsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(saveDeliveryLocation, () => setMessage(t('delivery.allowLocation')), { enableHighAccuracy: true });
    watchIdRef.current = navigator.geolocation.watchPosition(saveDeliveryLocation, () => setMessage(t('delivery.locationUpdateFailed')), {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    });
  };

  const stopSharing = async () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setSharing(false);
    if (user) {
      await supabase.from('delivery_locations').upsert({ user_id: user.id, is_sharing: false, updated_at: new Date().toISOString() });
    }
  };



  const acceptSelectedOrder = async () => {
    if (!selectedOrder) return;
    setMessage('');
    setAcceptingDelivery(true);

    const { error } = await supabase
      .from('orders')
      .update({ status: 'processing', delivery_accepted_at: new Date().toISOString() })
      .eq('id', selectedOrder.id);

    if (error) {
      setMessage(error.message || 'Could not accept this delivery.');
      setAcceptingDelivery(false);
      return;
    }

    setMessage(`Delivery accepted for order #${selectedOrder.id.slice(-6).toUpperCase()}.`);
    setAcceptingDelivery(false);
    await loadOrders();
  };

  const markSelectedOrderDelivered = async () => {
    if (!selectedOrder) return;
    const ok = window.confirm(`Mark order #${selectedOrder.id.slice(-6).toUpperCase()} as delivered?`);
    if (!ok) return;
    setMessage('');
    setMarkingDelivered(true);

    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', selectedOrder.id);

    if (orderError) {
      setMessage(orderError.message || 'Could not mark the order as delivered.');
      setMarkingDelivered(false);
      return;
    }

    await supabase.from('customer_locations').upsert({
      user_id: selectedOrder.user_id,
      active_order_id: null,
      is_sharing: false,
      updated_at: new Date().toISOString(),
    });

    const remainingActiveOrders = orders.filter((order) => order.id !== selectedOrder.id);

    setOrders(remainingActiveOrders);
    setSelectedOrderId(remainingActiveOrders[0]?.id || null);
    setMessage('Order marked as delivered. This customer can no longer see your live location, but your delivery location sharing remains ON for your next assigned delivery.');
    setMarkingDelivered(false);
    loadOrders();
  };

  const enrichOrders = useCallback(async (list: Order[], includeLiveData = false): Promise<EnrichedOrder[]> => {
    const userIds = [...new Set(list.map((o) => o.user_id).filter(Boolean))];
    const addressIds = [...new Set(list.map((o) => o.address_id).filter(Boolean))] as string[];
    const orderIds = list.map((o) => o.id);

    const [{ data: profiles }, { data: addresses }, { data: locations }, { data: points }] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('*').in('user_id', userIds) : Promise.resolve({ data: [] }),
      addressIds.length ? supabase.from('addresses').select('*').in('id', addressIds) : Promise.resolve({ data: [] }),
      includeLiveData && userIds.length ? supabase.from('customer_locations').select('*').eq('is_sharing', true).in('user_id', userIds) : Promise.resolve({ data: [] }),
      includeLiveData && orderIds.length ? supabase.from('customer_location_points').select('*').in('order_id', orderIds).order('recorded_at', { ascending: true }) : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map<string, Profile>((profiles || []).map((p: any) => [p.user_id, p as Profile]));
    const addressMap = new Map<string, Address>((addresses || []).map((a: any) => [a.id, a as Address]));
    const locMap = new Map<string, { latitude: number; longitude: number; updated_at: string }>((locations || []).map((l: any) => [l.user_id, l as { latitude: number; longitude: number; updated_at: string }]));
    const pointMap = new Map<string, LocationPoint[]>();
    for (const point of points || []) {
      const arr = pointMap.get(point.order_id) || [];
      arr.push(point as LocationPoint);
      pointMap.set(point.order_id, arr.slice(-100));
    }

    return list.map((order) => ({
      ...order,
      customer: profileMap.get(order.user_id),
      address: order.address_id ? addressMap.get(order.address_id) : undefined,
      customerLocation: includeLiveData ? locMap.get(order.user_id) || null : null,
      customerRoute: includeLiveData ? pointMap.get(order.id) || [] : [],
    }));
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const [{ data: activeOrderData }, { data: deliveredOrderData }] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .in('status', ACTIVE_ORDER_STATUSES)
        .eq('delivery_man_id', user?.id || '')
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('*')
        .eq('status', 'delivered')
        .eq('delivery_man_id', user?.id || '')
        .order('updated_at', { ascending: false }),
    ]);

    const activeList = (activeOrderData || []) as Order[];
    const deliveredList = (deliveredOrderData || []) as Order[];
    const [activeEnriched, deliveredEnriched] = await Promise.all([
      enrichOrders(activeList, true),
      enrichOrders(deliveredList, false),
    ]);

    setOrders(activeEnriched);
    setDeliveredOrders(deliveredEnriched);
    if (!selectedOrderId && activeEnriched[0]) setSelectedOrderId(activeEnriched[0].id);
    setLoading(false);
  }, [enrichOrders, selectedOrderId, user?.id]);

  useEffect(() => {
    loadGoogleMaps().then(() => setMapsReady(true)).catch((err) => setMapError(err instanceof Error ? err.message : 'Map failed to load'));
    loadOrders();
    const timer = window.setInterval(loadOrders, 3000);
    return () => { window.clearInterval(timer); if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [loadOrders]);

  useEffect(() => {
    if (!user || sharing || watchIdRef.current !== null) return;
    startSharing();
  }, [user, sharing]);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = new window.google!.maps.Map(mapRef.current, {
      center: { lat: 23.8103, lng: 90.4125 },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
  }, [mapsReady]);

  useEffect(() => {
    if (!mapsReady || !mapInstanceRef.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    polylinesRef.current.forEach((p) => p.setMap(null));
    markersRef.current = [];
    polylinesRef.current = [];

    const bounds = new window.google!.maps.LatLngBounds();
    const hasDelivery = Boolean(deliveryLocation);
    const customerPoint = selectedOrder?.customerLocation;

    if (deliveryLocation) {
      const pos = { lat: deliveryLocation.latitude, lng: deliveryLocation.longitude };
      bounds.extend(pos);
      markersRef.current.push(new window.google!.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        title: 'Delivery Man',
        icon: { path: window.google!.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#16a34a', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
      }));
    }

    if (customerPoint) {
      const customerPos = { lat: customerPoint.latitude, lng: customerPoint.longitude };
      bounds.extend(customerPos);
      markersRef.current.push(new window.google!.maps.Marker({
        position: customerPos,
        map: mapInstanceRef.current,
        title: selectedOrder?.customer?.full_name || 'Customer',
        icon: { path: window.google!.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#2563eb', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
      }));

      const customerRoute = (selectedOrder?.customerRoute || []).map((p) => ({ lat: p.latitude, lng: p.longitude }));
      if (customerRoute.length >= 2) {
        customerRoute.forEach((p) => bounds.extend(p));
        polylinesRef.current.push(new window.google!.maps.Polyline({
          path: customerRoute,
          geodesic: true,
          strokeColor: '#2563eb',
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map: mapInstanceRef.current,
        }));
      }

      if (hasDelivery) {
        const deliveryToCustomer = [{ lat: deliveryLocation!.latitude, lng: deliveryLocation!.longitude }, customerPos];
        polylinesRef.current.push(new window.google!.maps.Polyline({
          path: deliveryToCustomer,
          geodesic: true,
          strokeColor: '#16a34a',
          strokeOpacity: 0.9,
          strokeWeight: 5,
          icons: [{ icon: { path: window.google!.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: '#16a34a' }, offset: '100%' }],
          map: mapInstanceRef.current,
        }));
      }
    }

    if (!bounds.isEmpty()) mapInstanceRef.current.fitBounds(bounds, 80);
  }, [mapsReady, deliveryLocation, selectedOrder]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/CylinderExprerssLOGO.png" alt="Cylinder Express" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">{t('delivery.dashboard')}</h1>
              <p className="text-xs text-gray-500">{profile?.full_name} • {profile?.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle compact />
            <NotificationBell compact />
            <button onClick={signOut} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-semibold flex items-center gap-2">
              <LogOut className="w-4 h-4" /> {t('nav.signOut')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 grid lg:grid-cols-[380px,1fr] gap-6">
        <section className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">{t('delivery.sidebar')}</p>
            <div className="grid grid-cols-2 gap-2">
              <NotificationBell />
              <LanguageToggle />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-bold text-gray-900">{t('delivery.liveLocation')}</h2>
                <p className="text-xs text-gray-500">{t('delivery.liveLocationHelp')}</p>
              </div>
              <Navigation className="w-5 h-5 text-green-600" />
            </div>
            {message && <div className="mb-3 p-3 bg-amber-50 text-amber-700 rounded-xl text-sm">{message}</div>}
            {sharing ? (
              <button onClick={stopSharing} className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold text-sm">{t('delivery.stopSharing')}</button>
            ) : (
              <button onClick={startSharing} className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-sm">{t('delivery.startSharing')}</button>
            )}
            {deliveryLocation && <p className="text-xs text-gray-400 mt-3">Last: {deliveryLocation.latitude.toFixed(5)}, {deliveryLocation.longitude.toFixed(5)}</p>}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                <Headphones className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">{t('delivery.support')}</h2>
                <p className="text-xs text-gray-500">{t('delivery.supportHelp')}</p>
              </div>
            </div>
            <div className="grid gap-2">
              {CALL_CENTER_NUMBERS.map((number) => (
                <a key={number} href={`tel:${number}`} className="w-full py-2.5 px-3 rounded-xl bg-orange-600 text-white text-sm font-semibold flex items-center justify-center gap-2">
                  <Phone className="w-4 h-4" /> {t('delivery.call')} {number}
                </a>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-bold text-gray-900 flex items-center gap-2"><History className="w-5 h-5 text-purple-600" /> {t('delivery.deliveredOrders')}</h2>
                <p className="text-xs text-gray-500">{t('delivery.deliveredOrdersHelp')}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{deliveredOrders.length}</p>
                <p className="text-xs text-gray-500">{t('status.delivered')}</p>
              </div>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-3">
              <p className="text-xs text-green-700 flex items-center gap-1"><Wallet className="w-4 h-4" /> {t('delivery.totalDeliveredAmount')}</p>
              <p className="text-2xl font-bold text-green-800 mt-1">৳{deliveredTotal.toLocaleString('en-BD')}</p>
            </div>
            {deliveredOrders.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">{t('delivery.noDeliveredOrders')}</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {deliveredOrders.slice(0, 20).map((order) => (
                  <div key={order.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-gray-900 text-sm">#{order.id.slice(-6).toUpperCase()}</p>
                      <p className="font-bold text-green-700 text-sm">৳{Number(order.total_amount || 0).toLocaleString('en-BD')}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{order.customer?.full_name || 'Customer'} • {new Date(order.updated_at || order.created_at).toLocaleString('en-BD')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">{t('delivery.assignedActiveOrders')}</h2>
                <p className="text-xs text-gray-500">{t('delivery.assignedHelp')}</p>
              </div>
              <button onClick={loadOrders} className="p-2 bg-gray-50 rounded-xl text-gray-500"><RefreshCw className="w-4 h-4" /></button>
            </div>
            {loading ? <div className="p-6 text-center text-gray-400">{t('delivery.loadingOrders')}</div> : orders.length === 0 ? (
              <div className="p-6 text-center text-gray-400">{t('delivery.noAssignedOrders')}</div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[560px] overflow-y-auto">
                {orders.map((order) => (
                  <button key={order.id} onClick={() => setSelectedOrderId(order.id)} className={`w-full text-left p-4 hover:bg-gray-50 ${selectedOrder?.id === order.id ? 'bg-blue-50' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900">{t('delivery.order')} #{order.id.slice(-6).toUpperCase()}</p>
                        <p className="text-sm text-gray-600 flex items-center gap-1 mt-1"><User className="w-3.5 h-3.5" /> {order.customer?.full_name || 'Customer'}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Phone className="w-3.5 h-3.5" /> {order.customer?.phone || '-'}</p>
                      </div>
                      <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase">{order.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 flex items-start gap-1"><MapPin className="w-3.5 h-3.5 mt-0.5" /> {order.address ? `${order.address.address_line1}, ${order.address.area || order.address.city}` : t('delivery.addressNotFound')}</p>
                    <p className="text-xs text-gray-400 mt-2">{t('delivery.customerRoutePoints')}: {order.customerRoute?.length || 0} • {t('delivery.liveLocation')}: {order.customerLocation ? t('delivery.available') : t('delivery.notSharing')}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden min-h-[650px]">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-900 flex items-center gap-2"><Route className="w-5 h-5 text-blue-600" /> {t('delivery.routeView')}</h2>
              <p className="text-xs text-gray-500">{t('delivery.routeHelp')}</p>
            </div>
            {selectedOrder && <div className="text-xs text-gray-500 flex items-center gap-2"><Truck className="w-4 h-4" /> Selected #{selectedOrder.id.slice(-6).toUpperCase()}</div>}
          </div>
          {mapError ? (
            <div className="h-[590px] flex items-center justify-center text-center p-6">
              <div>
                <MapPin className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <p className="font-semibold text-gray-900">{t('adminLocations.mapError')}</p>
                <p className="text-sm text-gray-500 mt-1">{mapError}</p>
              </div>
            </div>
          ) : (
            <div ref={mapRef} className="h-[590px] w-full" />
          )}
          {selectedOrder && (
            <div className="p-5 border-t border-gray-100 space-y-3">
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">{t('delivery.customer')}</p><p className="font-semibold text-gray-900">{selectedOrder.customer?.full_name || '-'}</p></div>
                <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">{t('delivery.amount')}</p><p className="font-semibold text-gray-900">৳{selectedOrder.total_amount}</p></div>
                <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-400">{t('delivery.status')}</p><p className="font-semibold text-gray-900 flex items-center gap-1"><PackageCheck className="w-4 h-4" /> {selectedOrder.status}</p></div>
              </div>
              {!selectedOrder.delivery_accepted_at && selectedOrder.status !== 'processing' && (
                <button
                  onClick={acceptSelectedOrder}
                  disabled={acceptingDelivery}
                  className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <PackageCheck className="w-5 h-5" /> {acceptingDelivery ? t('delivery.updating') : 'Accept Delivery'}
                </button>
              )}
              <button
                onClick={markSelectedOrderDelivered}
                disabled={markingDelivered}
                className="w-full py-3 rounded-xl bg-green-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <CheckCircle2 className="w-5 h-5" /> {markingDelivered ? t('delivery.updating') : t('delivery.markDelivered')}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
