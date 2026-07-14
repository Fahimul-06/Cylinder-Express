import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Order, OrderItem, Profile, ServiceBooking } from '../../lib/types';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
import {
  ShoppingBag, Clock, Check, X, Truck, ChevronDown,
  ChevronUp, Filter, Building2, Tag, MapPin, Wrench, Calendar,
  PackageCheck, UserCheck
} from 'lucide-react';

const statusConfig: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  pending: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock, label: 'Pending' },
  confirmed: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Check, label: 'Confirmed' },
  processing: { color: 'bg-violet-50 text-violet-700 border-violet-200', icon: Truck, label: 'Processing' },
  in_progress: { color: 'bg-violet-50 text-violet-700 border-violet-200', icon: Truck, label: 'In Progress' },
  delivered: { color: 'bg-green-50 text-green-700 border-green-200', icon: Check, label: 'Delivered' },
  completed: { color: 'bg-green-50 text-green-700 border-green-200', icon: PackageCheck, label: 'Completed' },
  cancelled: { color: 'bg-red-50 text-red-700 border-red-200', icon: X, label: 'Cancelled' },
};

const orderStatuses = ['pending', 'confirmed', 'processing', 'delivered', 'cancelled'] as const;
const serviceStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const;
const allStatuses = ['pending', 'confirmed', 'processing', 'in_progress', 'delivered', 'completed', 'cancelled'] as const;
type EntryType = 'order' | 'service';
type UnifiedEntry =
  | { type: 'order'; id: string; created_at: string; status: string; data: Order }
  | { type: 'service'; id: string; created_at: string; status: string; data: ServiceBooking };

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<string, OrderItem[]>>({});
  const [addressMap, setAddressMap] = useState<Record<string, any>>({});
  const [profileMap, setProfileMap] = useState<Record<string, any>>({});
  const [deliveryMen, setDeliveryMen] = useState<Profile[]>([]);
  const [customerLocationMap, setCustomerLocationMap] = useState<Record<string, { latitude: number; longitude: number }>>({});
  const [deliveryPlusCodeCoords, setDeliveryPlusCodeCoords] = useState<Record<string, { latitude: number; longitude: number }>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | EntryType>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    fetchOrdersAndServices(true);
    const timer = window.setInterval(() => fetchOrdersAndServices(false), 5000);
    const onVisibilityChange = () => {
      if (!document.hidden) fetchOrdersAndServices(false);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  async function fetchOrdersAndServices(showLoader = true) {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (showLoader) setLoading(true);

    const [ordersRes, servicesRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('service_bookings').select('*, product:products(name, price, image_url, type)').order('created_at', { ascending: false }),
    ]);

    const orderList = ordersRes.data || [];
    const bookingList = servicesRes.data || [];
    setOrders(orderList);
    setBookings(bookingList);

    const orderIds = orderList.map((o: any) => o.id);
    const addressIds = [
      ...orderList.map((o: any) => o.address_id),
      ...bookingList.map((b: any) => b.address_id),
    ].filter(Boolean) as string[];
    const userIds = [...new Set([
      ...orderList.map((o: any) => o.user_id),
      ...bookingList.map((b: any) => b.user_id),
    ].filter(Boolean))];

    const [itemsRes, addrRes, profileRes, customerLocRes] = await Promise.all([
      orderIds.length > 0
        ? supabase.from('order_items').select('*, product:products(name, price, image_url, type)').in('order_id', orderIds)
        : Promise.resolve({ data: [] }),
      addressIds.length > 0
        ? supabase.from('addresses').select('*').in('id', [...new Set(addressIds)])
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? supabase.from('profiles').select('user_id, full_name, phone, email').in('user_id', userIds)
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? supabase.from('customer_locations').select('user_id, latitude, longitude').in('user_id', userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const deliveryRes = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'delivery')
      .order('full_name', { ascending: true });
    const deliveryProfiles = (deliveryRes.data || []) as Profile[];
    setDeliveryMen(deliveryProfiles);
    geocodeDeliveryPlusCodes(deliveryProfiles);

    const iMap: Record<string, OrderItem[]> = {};
    if (itemsRes.data) {
      for (const item of itemsRes.data) {
        if (!iMap[item.order_id]) iMap[item.order_id] = [];
        iMap[item.order_id].push(item);
      }
    }
    setItemsMap(iMap);

    const aMap: Record<string, any> = {};
    if (addrRes.data) for (const a of addrRes.data) aMap[a.id] = a;
    setAddressMap(aMap);

    const pMap: Record<string, { user_id: string; full_name: string; phone: string; email?: string }> = {};
    if (profileRes.data) for (const p of profileRes.data) pMap[p.user_id] = p;
    setProfileMap(pMap);

    const cMap: Record<string, { latitude: number; longitude: number }> = {};
    if (customerLocRes.data) {
      for (const loc of customerLocRes.data) {
        if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') cMap[loc.user_id] = loc;
      }
    }
    setCustomerLocationMap(cMap);
    setLastUpdated(new Date());
    fetchingRef.current = false;
    if (showLoader) setLoading(false);
  }

  async function geocodeDeliveryPlusCodes(deliveryProfiles: Profile[]) {
    const withPlusCode = deliveryProfiles.filter((man) =>
      man.permanent_plus_code &&
      !deliveryPlusCodeCoords[man.user_id] &&
      !(typeof man.permanent_latitude === 'number' && typeof man.permanent_longitude === 'number')
    );
    if (!GOOGLE_MAPS_API_KEY || withPlusCode.length === 0) return;

    const results: Record<string, { latitude: number; longitude: number }> = {};
    await Promise.all(withPlusCode.map(async (man) => {
      try {
        const query = encodeURIComponent(man.permanent_plus_code || '');
        const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${GOOGLE_MAPS_API_KEY}`);
        const data = await response.json();
        const loc = data?.results?.[0]?.geometry?.location;
        if (typeof loc?.lat === 'number' && typeof loc?.lng === 'number') {
          results[man.user_id] = { latitude: loc.lat, longitude: loc.lng };
        }
      } catch {
        // Keep assignment page usable even if one plus code cannot be geocoded.
      }
    }));

    if (Object.keys(results).length > 0) {
      setDeliveryPlusCodeCoords((prev) => ({ ...prev, ...results }));
    }
  }

  async function updateEntryStatus(type: EntryType, id: string, status: string) {
    const updateKey = `${type}:${id}`;
    setUpdating(updateKey);

    if (type === 'order') {
      await supabase.from('orders').update({ status }).eq('id', id);

      if (['delivered', 'completed', 'cancelled'].includes(status)) {
        const order = orders.find(o => o.id === id);
        if (order?.user_id) {
          await supabase
            .from('customer_locations')
            .update({
              is_sharing: false,
              active_order_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', order.user_id);
        }
      }

      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as Order['status'] } : o));
    } else {
      await supabase.from('service_bookings').update({ status }).eq('id', id);
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: status as ServiceBooking['status'] } : b));
    }

    setUpdating(null);
  }


  async function assignDeliveryMan(orderId: string, deliveryManId: string) {
    const normalizedDeliveryManId = deliveryManId || null;
    await supabase.from('orders').update({ delivery_man_id: normalizedDeliveryManId }).eq('id', orderId);
    setOrders(prev => prev.map(order => order.id === orderId ? { ...order, delivery_man_id: normalizedDeliveryManId } : order));
  }

  const entries = useMemo<UnifiedEntry[]>(() => {
    return [
      ...orders.map((order): UnifiedEntry => ({ type: 'order', id: order.id, created_at: order.created_at, status: order.status, data: order })),
      ...bookings.map((booking): UnifiedEntry => ({ type: 'service', id: booking.id, created_at: booking.created_at, status: booking.status, data: booking })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders, bookings]);

  const filtered = entries.filter(entry => {
    const typeOk = typeFilter === 'all' || entry.type === typeFilter;
    const statusOk = statusFilter === 'all' || entry.status === statusFilter;
    return typeOk && statusOk;
  });

  const calcOrderTotal = (o: Order) =>
    o.total_amount + o.delivery_fee + (o.floor_charge || 0) - (o.discount_amount || 0);


  const distanceMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const hav = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
  };

  const getOrderTargetPoint = (order: Order, addr: any) => {
    const live = customerLocationMap[order.user_id];
    if (live) return { latitude: live.latitude, longitude: live.longitude, source: 'customer live location' };
    if (typeof addr?.latitude === 'number' && typeof addr?.longitude === 'number') {
      return { latitude: addr.latitude, longitude: addr.longitude, source: 'delivery address' };
    }
    return null;
  };

  const getNearestDeliveryMen = (order: Order, addr: any) => {
    const target = getOrderTargetPoint(order, addr);
    if (!target) return [];
    return deliveryMen
      .map((man) => {
        const plusCodePoint = deliveryPlusCodeCoords[man.user_id];
        const basePoint = typeof man.permanent_latitude === 'number' && typeof man.permanent_longitude === 'number'
          ? { latitude: Number(man.permanent_latitude), longitude: Number(man.permanent_longitude) }
          : plusCodePoint;
        return basePoint ? {
          ...man,
          distance_m: distanceMeters(
            { latitude: target.latitude, longitude: target.longitude },
            basePoint
          ),
        } : null;
      })
      .filter((man): man is Profile & { distance_m: number } => Boolean(man))
      .filter((man) => man.distance_m <= 600 || man.user_id === order.delivery_man_id)
      .sort((a, b) => a.distance_m - b.distance_m);
  };

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders & Service Bookings</h1>
          <p className="text-sm text-gray-500">
            {orders.length} product orders · {bookings.length} service bookings
          </p>
          <p className="text-xs text-green-600 mt-1">Auto-updating every 5 seconds{lastUpdated ? ` · Last checked ${lastUpdated.toLocaleTimeString('en-BD')}` : ''}</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as 'all' | EntryType)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            >
              <option value="all">All Types</option>
              <option value="order">Product Orders</option>
              <option value="service">Service Bookings</option>
            </select>
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          >
            <option value="all">All Statuses</option>
            {allStatuses.map(s => (
              <option key={s} value={s}>{statusConfig[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500">No orders or service bookings found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => {
            const isService = entry.type === 'service';
            const itemKey = `${entry.type}:${entry.id}`;
            const sc = statusConfig[entry.status] || statusConfig.pending;
            const StatusIcon = sc.icon;
            const isExpanded = expanded === itemKey;
            const availableStatuses = isService ? serviceStatuses : orderStatuses;
            const customer = profileMap[entry.data.user_id];
            const addr = entry.data.address_id ? addressMap[entry.data.address_id] : null;

            if (isService) {
              const booking = entry.data as ServiceBooking;
              const servicePrice = booking.product?.price || 0;
              return (
                <div key={itemKey} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : itemKey)}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                        <Wrench className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm">#{booking.id.slice(0, 8)}</p>
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-100">
                            Service Booking
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {customer?.full_name || 'Customer'} &middot; {new Date(booking.created_at).toLocaleDateString('en-BD', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${sc.color}`}>
                        {sc.label}
                      </span>
                      <span className="font-bold text-gray-900">৳{servicePrice.toLocaleString()}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-4">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-400 mb-1">Customer</p>
                          <p className="text-sm font-semibold text-gray-900">{customer?.full_name || 'N/A'}</p>
                          <p className="text-xs text-gray-500">{customer?.phone || customer?.email || ''}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Schedule
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            {booking.scheduled_date || 'Not selected'} {booking.scheduled_time ? `at ${booking.scheduled_time}` : ''}
                          </p>
                          <p className="text-xs text-gray-500">Booked {new Date(booking.created_at).toLocaleString('en-BD')}</p>
                        </div>
                        {addr && (
                          <div className="bg-gray-50 rounded-xl p-3 sm:col-span-2">
                            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> Service Address
                            </p>
                            <p className="text-sm font-medium text-gray-900">{addr.address_line1}</p>
                            <p className="text-xs text-gray-500">{addr.area && `${addr.area}, `}{addr.city}</p>
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-gray-100 p-3 flex items-center justify-between text-sm">
                        <div>
                          <p className="font-semibold text-gray-900">{booking.product?.name || 'Service'}</p>
                          <p className="text-xs text-gray-500">Service request</p>
                        </div>
                        <span className="font-bold text-blue-600">৳{servicePrice.toLocaleString()}</span>
                      </div>

                      {booking.notes && (
                        <div className="bg-gray-50 rounded-xl p-3 text-sm">
                          <span className="text-gray-400">Notes: </span>
                          <span className="text-gray-700">{booking.notes}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                        {availableStatuses.map(s => {
                          const cfg = statusConfig[s];
                          const isActive = booking.status === s;
                          return (
                            <button
                              key={s}
                              onClick={() => updateEntryStatus('service', booking.id, s)}
                              disabled={isActive || updating === itemKey}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 ${cfg.color} hover:opacity-80`}
                            >
                              <cfg.icon className="w-3.5 h-3.5" />
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            const order = entry.data as Order;
            const items = itemsMap[order.id] || [];
            const targetPoint = getOrderTargetPoint(order, addr);
            const nearestDeliveryMen = getNearestDeliveryMen(order, addr);
            return (
              <div key={itemKey} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : itemKey)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${sc.color.split(' ')[0]} rounded-xl flex items-center justify-center`}>
                      <StatusIcon className={`w-5 h-5 ${sc.color.split(' ')[1]}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm">#{order.id.slice(0, 8)}</p>
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-100">
                          Product Order
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {customer?.full_name || 'Customer'} &middot; {new Date(order.created_at).toLocaleDateString('en-BD', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${sc.color}`}>
                      {sc.label}
                    </span>
                    <span className="font-bold text-gray-900">৳{calcOrderTotal(order).toLocaleString()}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1">Customer</p>
                        <p className="text-sm font-semibold text-gray-900">{customer?.full_name || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{customer?.phone || customer?.email || ''}</p>
                      </div>
                      {addr && (
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> Delivery Address
                          </p>
                          <p className="text-sm font-medium text-gray-900">{addr.address_line1}</p>
                          <p className="text-xs text-gray-500">{addr.area && `${addr.area}, `}{addr.city}</p>
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="w-4 h-4 text-blue-600" />
                        <p className="text-sm font-semibold text-gray-900">Assign HUB Man</p>
                      </div>
                      <select
                        value={order.delivery_man_id || ''}
                        onChange={(event) => assignDeliveryMan(order.id, event.target.value)}
                        className="w-full px-3 py-2 bg-white border border-blue-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      >
                        <option value="">Not assigned</option>
                        {nearestDeliveryMen.map((man) => (
                          <option key={man.user_id} value={man.user_id}>
                            {man.full_name} — {man.phone} — {Math.round((man as any).distance_m)}m
                          </option>
                        ))}
                      </select>
                      {order.delivery_man_id ? (
                        <p className="text-xs text-blue-700 mt-2">Assigned HUB Man can see this order and customer route in the HUB Man Dashboard.</p>
                      ) : targetPoint ? (
                        <p className="text-xs text-blue-700 mt-2">Showing {nearestDeliveryMen.length} HUB man{nearestDeliveryMen.length === 1 ? '' : 's'} within 600m of the {targetPoint.source}. Select one after confirming/processing the order.</p>
                      ) : (
                        <p className="text-xs text-red-600 mt-2">No customer coordinate found yet. Save customer address latitude/longitude or wait for customer live location to assign nearest HUB man.</p>
                      )}
                    </div>

                    {items.length > 0 && (
                      <div className="divide-y divide-gray-50">
                        {items.map(item => (
                          <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                            <span className="text-gray-700">{item.product?.name || 'Item'}{item.selected_order_type ? ` · ${item.selected_order_type === 'new' ? 'New' : 'Refill'}` : ''}{item.selected_valve_connection ? ` · ${item.selected_valve_connection}` : ''}{item.selected_valve_size ? ` · ${item.selected_valve_size}` : ''} &times; {item.quantity}</span>
                            <span className="font-medium">৳{(item.unit_price * item.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2 text-sm">
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
                        <span className="text-gray-500">Delivery Fee</span>
                        <span className="font-medium">৳{order.delivery_fee}</span>
                      </div>
                      {order.floor_number != null && (
                        <div className="flex justify-between">
                          <span className="text-gray-500 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" /> Floor Charge ({order.floor_number === 1 ? 'Ground' : `${order.floor_number}F`})
                          </span>
                          <span className="font-medium">{(order.floor_charge || 0) > 0 ? `৳${order.floor_charge}` : 'Free'}</span>
                        </div>
                      )}
                      <div className="border-t border-gray-100 pt-2 flex justify-between">
                        <span className="font-bold text-gray-900">Total</span>
                        <span className="font-bold text-blue-600">৳{calcOrderTotal(order).toLocaleString()}</span>
                      </div>
                      {order.notes && (
                        <div className="bg-gray-50 rounded-xl p-3 mt-2 text-sm">
                          <span className="text-gray-400">Notes: </span>
                          <span className="text-gray-700">{order.notes}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                      {availableStatuses.map(s => {
                        const cfg = statusConfig[s];
                        const isActive = order.status === s;
                        return (
                          <button
                            key={s}
                            onClick={() => updateEntryStatus('order', order.id, s)}
                            disabled={isActive || updating === itemKey}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 ${cfg.color} hover:opacity-80`}
                          >
                            <cfg.icon className="w-3.5 h-3.5" />
                            {cfg.label}
                          </button>
                        );
                      })}
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
