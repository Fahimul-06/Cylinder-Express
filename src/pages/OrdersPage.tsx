import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Order, OrderItem, ServiceBooking, Profile, DeliveryLocation, LocationPoint, Address } from '../lib/types';
import {
  ShoppingBag, Wrench, Clock, Check, X, Truck,
  ChevronDown, ChevronUp, Package, Calendar, Tag, Building2,
  MapPin, Navigation, WifiOff, Phone
} from 'lucide-react';

type Tab = 'orders' | 'services';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) return reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'));
    if (window.google?.maps) return resolve();
    const existing = document.getElementById('google-maps-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps')), { once: true });
      return;
    }
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

function formatOrderAddress(address?: Address | null) {
  if (!address) return '';
  return [address.address_line1, address.address_line2, address.area, address.city, address.district]
    .filter(Boolean)
    .join(', ');
}

function DeliveryMovementMap({
  deliveryLive,
  routePoints,
  customerPoint,
  customerAddressText,
}: {
  deliveryLive: DeliveryLocation;
  routePoints: LocationPoint[];
  customerPoint?: { lat: number; lng: number } | null;
  customerAddressText?: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const directionsRendererRef = useRef<any | null>(null);
  const overlaysRef = useRef<any[]>([]);
  const [mapError, setMapError] = useState('');
  const [deliveryPlaceName, setDeliveryPlaceName] = useState('Detecting HUB man place...');

  useEffect(() => {
    let cancelled = false;
    async function detectPlaceName() {
      try {
        await loadGoogleMaps();
        const maps = (window.google as any)?.maps;
        if (cancelled || !maps) return;
        const geocoder = new maps.Geocoder();
        geocoder.geocode(
          { location: { lat: deliveryLive.latitude, lng: deliveryLive.longitude } },
          (results: any[], status: string) => {
            if (cancelled) return;
            if (status === 'OK' && results?.[0]?.formatted_address) {
              setDeliveryPlaceName(results[0].formatted_address);
            } else {
              setDeliveryPlaceName('Live location detected, place name unavailable');
            }
          }
        );
      } catch {
        if (!cancelled) setDeliveryPlaceName('Live location detected');
      }
    }
    detectPlaceName();
    return () => { cancelled = true; };
  }, [deliveryLive.latitude, deliveryLive.longitude]);

  useEffect(() => {
    let cancelled = false;
    async function renderMap() {
      try {
        await loadGoogleMaps();
        const maps = (window.google as any)?.maps;
        if (cancelled || !mapRef.current || !maps) return;

        const current = { lat: deliveryLive.latitude, lng: deliveryLive.longitude };
        const cleanRoute = routePoints
          .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
          .slice(-100)
          .map((point) => ({ lat: point.latitude, lng: point.longitude }));

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new maps.Map(mapRef.current, {
            center: customerPoint || current,
            zoom: 15,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          });
        }

        overlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
        overlaysRef.current = [];
        if (directionsRendererRef.current) {
          directionsRendererRef.current.setMap(null);
          directionsRendererRef.current = null;
        }

        const bounds = new maps.LatLngBounds();
        bounds.extend(current);
        if (customerPoint) bounds.extend(customerPoint);
        cleanRoute.forEach((point) => bounds.extend(point));

        const deliveryMarker = new maps.Marker({
          position: current,
          map: mapInstanceRef.current,
          title: 'HUB Man live location',
          label: 'D',
        });
        overlaysRef.current.push(deliveryMarker);

        if (customerPoint) {
          const customerMarker = new maps.Marker({
            position: customerPoint,
            map: mapInstanceRef.current,
            title: customerAddressText || 'Customer delivery address',
            label: 'C',
          });
          overlaysRef.current.push(customerMarker);

          const directionsService = new maps.DirectionsService();
          const directionsRenderer = new maps.DirectionsRenderer({
            map: mapInstanceRef.current,
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor: '#2563eb',
              strokeOpacity: 0.95,
              strokeWeight: 5,
            },
          });
          directionsRendererRef.current = directionsRenderer;

          directionsService.route(
            {
              origin: customerPoint,
              destination: current,
              travelMode: maps.TravelMode.DRIVING,
            },
            (result: any, status: string) => {
              if (cancelled) return;
              if (status === 'OK' && result) {
                directionsRenderer.setDirections(result);
                mapInstanceRef.current.fitBounds(bounds);
              } else {
                const fallbackLine = new maps.Polyline({
                  path: [customerPoint, current],
                  geodesic: true,
                  strokeColor: '#2563eb',
                  strokeOpacity: 0.85,
                  strokeWeight: 4,
                  map: mapInstanceRef.current,
                });
                overlaysRef.current.push(fallbackLine);
                mapInstanceRef.current.fitBounds(bounds);
              }
            }
          );
        } else if (cleanRoute.length > 0) {
          const path = [...cleanRoute, current];
          const polyline = new maps.Polyline({
            path,
            geodesic: true,
            strokeColor: '#16a34a',
            strokeOpacity: 0.95,
            strokeWeight: 4,
            map: mapInstanceRef.current,
          });
          overlaysRef.current.push(polyline);
          mapInstanceRef.current.fitBounds(bounds);
        } else {
          mapInstanceRef.current.setCenter(current);
          mapInstanceRef.current.setZoom(16);
        }
      } catch (err) {
        if (!cancelled) setMapError(err instanceof Error ? err.message : 'Could not load delivery map');
      }
    }

    renderMap();
    return () => {
      cancelled = true;
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }
    };
  }, [deliveryLive.latitude, deliveryLive.longitude, routePoints, customerPoint?.lat, customerPoint?.lng, customerAddressText]);

  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-green-100 bg-white">
      <div className="px-3 py-2 bg-white space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-green-900">Live delivery movement</p>
            <p className="text-[11px] text-gray-500">Tracking inside this order page</p>
          </div>
          <span className="text-[11px] text-gray-400">Last updated {new Date(deliveryLive.updated_at || deliveryLive.last_seen).toLocaleTimeString('en-BD')}</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg bg-blue-50 px-2.5 py-2">
            <p className="font-bold text-blue-800">Customer address</p>
            <p className="text-blue-700 mt-0.5">{customerAddressText || 'Customer delivery address will show when saved.'}</p>
          </div>
          <div className="rounded-lg bg-green-50 px-2.5 py-2">
            <p className="font-bold text-green-800">HUB Man live place</p>
            <p className="text-green-700 mt-0.5">{deliveryPlaceName}</p>
          </div>
        </div>
      </div>
      {mapError ? (
        <div className="p-3 text-xs text-red-600 bg-red-50">{mapError}</div>
      ) : (
        <div ref={mapRef} className="h-64 w-full bg-green-50" />
      )}
    </div>
  );
}


const statusConfig: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  pending: { color: 'bg-amber-50 text-amber-700', icon: Clock, label: 'Pending' },
  confirmed: { color: 'bg-blue-50 text-blue-700', icon: Check, label: 'Confirmed' },
  processing: { color: 'bg-purple-50 text-purple-700', icon: Truck, label: 'Processing' },
  in_progress: { color: 'bg-blue-50 text-blue-700', icon: Wrench, label: 'In Progress' },
  delivered: { color: 'bg-green-50 text-green-700', icon: Check, label: 'Delivered' },
  completed: { color: 'bg-green-50 text-green-700', icon: Check, label: 'Completed' },
  cancelled: { color: 'bg-red-50 text-red-700', icon: X, label: 'Cancelled' },
};

function LocationShareBanner({ userId, activeOrder }: { userId: string; activeOrder: Order | null }) {
  const activeOrderId = activeOrder?.id || null;
  const isLockedByAdmin = Boolean(activeOrder && ['confirmed', 'processing'].includes(activeOrder.status));
  const [isSharing, setIsSharing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const watchRef = useRef<number | null>(null);

  async function saveLivePoint(uid: string, orderId: string, latitude: number, longitude: number, accuracy?: number | null) {
    const now = new Date().toISOString();
    await supabase.from('customer_locations').upsert(
      {
        user_id: uid,
        active_order_id: orderId,
        latitude,
        longitude,
        accuracy: accuracy || null,
        is_sharing: true,
        last_seen: now,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    );

    await supabase.from('customer_location_points').insert({
      user_id: uid,
      order_id: orderId,
      latitude,
      longitude,
      accuracy: accuracy || null,
      recorded_at: now,
    });
  }

  function startWatching(uid: string, orderId: string) {
    if (!navigator.geolocation || !orderId) return;
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        saveLivePoint(uid, orderId, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      () => setError('Location access denied. Please allow location permission for delivery tracking.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }

  function requestAndStartSharing(uid: string, orderId: string) {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await saveLivePoint(uid, orderId, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        setIsSharing(true);
        startWatching(uid, orderId);
      },
      () => setError('Please allow location access. Live location is required for confirmed deliveries.'),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    );
  }

  useEffect(() => {
    let mounted = true;
    supabase
      .from('customer_locations')
      .select('is_sharing, active_order_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        if (data?.is_sharing && activeOrderId) {
          setIsSharing(true);
          startWatching(userId, activeOrderId);
        }
        setLoading(false);
      });
    return () => {
      mounted = false;
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [userId]);

  useEffect(() => {
    if (!activeOrderId) {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      if (isSharing) {
        supabase.from('customer_locations').upsert(
          { user_id: userId, active_order_id: null, latitude: 0, longitude: 0, is_sharing: false, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
        setIsSharing(false);
      }
      return;
    }

    // Automatically start live location sharing for every active order after checkout.
    if (!isSharing) {
      requestAndStartSharing(userId, activeOrderId);
    } else {
      startWatching(userId, activeOrderId);
    }
  }, [activeOrderId]);

  async function toggleSharing() {
    setError('');
    if (!activeOrderId) {
      setError('Live location can be shared only while you have an active order.');
      return;
    }
    if (isSharing) {
      if (isLockedByAdmin) {
        setError('Administration Head confirmed this order. Live location cannot be stopped until delivery is completed or cancelled.');
        return;
      }
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      await supabase.from('customer_locations').upsert(
        { user_id: userId, active_order_id: null, latitude: 0, longitude: 0, is_sharing: false, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
      setIsSharing(false);
    } else {
      requestAndStartSharing(userId, activeOrderId);
    }
  }

  if (loading || !activeOrder) return null;

  return (
    <div className={`rounded-2xl border p-4 mb-4 transition-all ${isSharing ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isSharing ? 'bg-blue-600' : 'bg-gray-100'}`}>
            {isSharing ? <Navigation className="w-5 h-5 text-white" /> : <MapPin className="w-5 h-5 text-gray-400" />}
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">
              {isSharing ? 'Sharing live location' : 'Starting live location'}
            </p>
            <p className="text-xs text-gray-500">
              {isLockedByAdmin
                ? 'Administration Head confirmed this order. Tracking stays on until delivery is completed.'
                : 'Live location starts automatically after placing an order.'}
            </p>
          </div>
        </div>
        <button
          onClick={toggleSharing}
          title={isLockedByAdmin ? 'Locked after Administration Head confirmation' : undefined}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${isSharing ? 'bg-blue-600' : 'bg-gray-200'} ${isLockedByAdmin ? 'cursor-not-allowed opacity-80' : ''}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isSharing ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      {isSharing && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-green-700 font-medium">Live — updating every few seconds</span>
        </div>
      )}
      {isLockedByAdmin && (
        <div className="mt-2 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg px-3 py-2">
          Location sharing is locked because the Administration Head confirmed this order.
        </div>
      )}
      {error && (
        <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
          <WifiOff className="w-3.5 h-3.5" /> {error}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<string, OrderItem[]>>({});
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [deliveryProfiles, setDeliveryProfiles] = useState<Record<string, Profile>>({});
  const [deliveryLocations, setDeliveryLocations] = useState<Record<string, DeliveryLocation>>({});
  const [deliveryRoutes, setDeliveryRoutes] = useState<Record<string, LocationPoint[]>>({});
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    async function fetchData() {
      const [ordRes, bookRes] = await Promise.all([
        supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('service_bookings').select('*, product:products(name, price)').eq('user_id', userId).order('created_at', { ascending: false }),
      ]);
      const rawOrders = (ordRes.data || []) as Order[];
      const addressIds = [...new Set(rawOrders.map((order) => order.address_id).filter(Boolean))] as string[];
      let addressMap: Record<string, Address> = {};
      if (addressIds.length > 0) {
        const { data: addressData } = await supabase
          .from('addresses')
          .select('*')
          .in('id', addressIds);
        addressMap = Object.fromEntries(((addressData || []) as Address[]).map((address) => [address.id, address]));
      }
      const orderList = rawOrders.map((order) => ({
        ...order,
        address: order.address_id ? addressMap[order.address_id] || order.address : order.address,
      }));
      setOrders(orderList);
      setBookings(bookRes.data || []);

      const deliveryIds = [...new Set(orderList.map((order: Order) => order.delivery_man_id).filter(Boolean))] as string[];
      if (deliveryIds.length > 0) {
        const activeAssignedOrderIds = orderList
          .filter((order: Order) => order.delivery_man_id && !['delivered', 'cancelled'].includes(order.status))
          .map((order: Order) => order.id);

        const [{ data: deliveryProfilesData }, { data: deliveryLocationsData }, { data: deliveryRouteData }] = await Promise.all([
          supabase.from('profiles').select('*').in('user_id', deliveryIds),
          supabase.from('delivery_locations').select('*').eq('is_sharing', true).in('user_id', deliveryIds),
          activeAssignedOrderIds.length > 0
            ? supabase.from('delivery_location_points').select('*').in('order_id', activeAssignedOrderIds).order('recorded_at', { ascending: true })
            : Promise.resolve({ data: [] }),
        ]);
        setDeliveryProfiles(Object.fromEntries((deliveryProfilesData || []).map((item: Profile) => [item.user_id, item])));
        setDeliveryLocations(Object.fromEntries((deliveryLocationsData || []).map((item: DeliveryLocation) => [item.user_id, item])));

        const routeMap: Record<string, LocationPoint[]> = {};
        for (const point of deliveryRouteData || []) {
          if (!point.order_id) continue;
          if (!routeMap[point.order_id]) routeMap[point.order_id] = [];
          routeMap[point.order_id].push(point as LocationPoint);
          routeMap[point.order_id] = routeMap[point.order_id].slice(-100);
        }
        setDeliveryRoutes(routeMap);
      } else {
        setDeliveryProfiles({});
        setDeliveryLocations({});
        setDeliveryRoutes({});
      }

      // Fetch order items for all orders
      if (orderList.length > 0) {
        const orderIds = orderList.map((o: any) => o.id);
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('*, product:products(name, price, image_url)')
          .in('order_id', orderIds);
        if (itemsData) {
          const map: Record<string, OrderItem[]> = {};
          for (const item of itemsData) {
            if (!map[item.order_id]) map[item.order_id] = [];
            map[item.order_id].push(item);
          }
          setOrderItemsMap(map);
        }
      } else {
        setOrderItemsMap({});
      }
      setLoading(false);
    }
    fetchData();
  }, [user]);

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

  const calcTotal = (order: Order) =>
    order.total_amount + order.delivery_fee + (order.floor_charge || 0) - (order.discount_amount || 0);

  const activeOrder = orders.find(order => !['delivered', 'cancelled'].includes(order.status)) || null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">My Orders & Bookings</h1>

        {user && <LocationShareBanner userId={user.id} activeOrder={activeOrder} />}

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setTab('orders')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === 'orders' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> Orders ({orders.length})
          </button>
          <button
            onClick={() => setTab('services')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === 'services' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            <Wrench className="w-4 h-4" /> Services ({bookings.length})
          </button>
        </div>

        {tab === 'orders' ? (
          orders.length > 0 ? (
            <div className="space-y-3">
              {orders.map(order => {
                const sc = statusConfig[order.status] || statusConfig.pending;
                const StatusIcon = sc.icon;
                const expanded = expandedOrder === order.id;
                const orderItems = orderItemsMap[order.id] || [];
                return (
                  <div key={order.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <button
                      onClick={() => setExpandedOrder(expanded ? null : order.id)}
                      className="w-full p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                          <Package className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-900 text-sm">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(order.created_at).toLocaleDateString('en-BD', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sc.color}`}>
                          <StatusIcon className="w-3 h-3" /> {sc.label}
                        </span>
                        <span className="font-bold text-orange-600">৳{calcTotal(order).toLocaleString()}</span>
                        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>
                    {expanded && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                        {/* Items */}
                        {orderItems.length > 0 && (
                          <div className="divide-y divide-gray-50">
                            {orderItems.map(item => (
                              <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                                <span className="text-gray-700">
                                  {item.product?.name || 'Item'}
                                  {item.selected_order_type ? ` · ${item.selected_order_type === 'new' ? 'New' : 'Refill'}` : ''}
                                  {item.selected_valve_connection ? ` · ${item.selected_valve_connection}` : ''}
                                  {item.selected_valve_size ? ` · ${item.selected_valve_size}` : ''}
                                  {' '}× {item.quantity}
                                </span>
                                <span className="font-medium text-gray-900">৳{(item.unit_price * item.quantity).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Charge breakdown */}
                        <div className="space-y-2 text-sm pt-2">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Subtotal</span>
                            <span className="font-medium">৳{order.total_amount.toLocaleString()}</span>
                          </div>

                          {(order.discount_amount || 0) > 0 && (
                            <div className="flex justify-between">
                              <span className="text-green-600 flex items-center gap-1">
                                <Tag className="w-3.5 h-3.5" /> Discount {order.promo_code ? `(${order.promo_code})` : ''}
                              </span>
                              <span className="font-semibold text-green-600">-৳{(order.discount_amount || 0).toLocaleString()}</span>
                            </div>
                          )}

                          <div className="flex justify-between">
                            <span className="text-gray-500 flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5" /> Delivery Fee
                            </span>
                            <span className="font-medium">৳{order.delivery_fee}</span>
                          </div>

                          {order.floor_number != null && (
                            <div className="flex justify-between">
                              <span className="text-gray-500 flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5" /> Floor Charge ({order.floor_number === 1 ? 'Ground' : `${order.floor_number}${getOrdinal(order.floor_number)} fl.`})
                              </span>
                              <span className={`font-medium ${(order.floor_charge || 0) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                {(order.floor_charge || 0) > 0 ? `৳${order.floor_charge}` : 'Free'}
                              </span>
                            </div>
                          )}

                          <div className="border-t border-gray-100 pt-2 flex justify-between">
                            <span className="font-bold text-gray-900">Total</span>
                            <span className="font-bold text-blue-600">৳{calcTotal(order).toLocaleString()}</span>
                          </div>
                        </div>

                        {order.delivery_man_id && (() => {
                          const deliveryMan = deliveryProfiles[order.delivery_man_id!];
                          const isDeliveryActive = !['delivered', 'cancelled'].includes(order.status);
                          const deliveryLive = isDeliveryActive ? deliveryLocations[order.delivery_man_id!] : undefined;
                          return (
                            <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm">
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                  <Truck className="w-4 h-4 text-green-700" />
                                  <span className="font-bold text-green-900">Assigned HUB Man</span>
                                </div>
                                {deliveryLive && <span className="text-[11px] font-bold text-green-700 flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Live</span>}
                              </div>
                              <div className="grid sm:grid-cols-2 gap-2">
                                <div>
                                  <p className="text-xs text-green-700">Name</p>
                                  <p className="font-semibold text-gray-900">{deliveryMan?.full_name || 'HUB Man assigned'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-green-700">Phone</p>
                                  {deliveryMan?.phone ? (
                                    <a href={`tel:${deliveryMan.phone}`} className="font-semibold text-blue-700 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {deliveryMan.phone}</a>
                                  ) : <p className="font-semibold text-gray-500">Not available</p>}
                                </div>
                              </div>
                              {deliveryLive ? (
                                <DeliveryMovementMap
                                  deliveryLive={deliveryLive}
                                  routePoints={deliveryRoutes[order.id] || []}
                                  customerPoint={order.address?.latitude && order.address?.longitude ? { lat: order.address.latitude, lng: order.address.longitude } : null}
                                  customerAddressText={formatOrderAddress(order.address)}
                                />
                              ) : (
                                <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
                                  {isDeliveryActive ? 'HUB Man has not started live location sharing yet.' : 'Delivery completed. Live delivery location sharing has stopped.'}
                                </p>
                              )}
                            </div>
                          );
                        })()}

                        {order.notes && (
                          <div className="text-sm bg-gray-50 rounded-xl p-3 mt-2">
                            <span className="text-gray-500">Notes: </span>
                            <span className="text-gray-700">{order.notes}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders yet</h3>
              <p className="text-gray-500 text-sm">Place your first order to see it here</p>
            </div>
          )
        ) : (
          bookings.length > 0 ? (
            <div className="space-y-3">
              {bookings.map(booking => {
                const sc = statusConfig[booking.status] || statusConfig.pending;
                const StatusIcon = sc.icon;
                return (
                  <div key={booking.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Wrench className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{booking.product?.name || 'Service'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(booking.created_at).toLocaleDateString('en-BD', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            })}
                          </p>
                          {booking.scheduled_date && (
                            <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                              <Calendar className="w-3 h-3" />
                              {booking.scheduled_date} {booking.scheduled_time && `at ${booking.scheduled_time}`}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sc.color}`}>
                          <StatusIcon className="w-3 h-3" /> {sc.label}
                        </span>
                        <span className="font-bold text-blue-600 text-sm">৳{(booking.product?.price || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    {booking.notes && (
                      <p className="text-xs text-gray-500 mt-2 pl-13">{booking.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wrench className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No service bookings</h3>
              <p className="text-gray-500 text-sm">Book a service to see it here</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function getOrdinal(n: number): string {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}
