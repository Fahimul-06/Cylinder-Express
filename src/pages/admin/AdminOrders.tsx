import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Order, OrderItem } from '../../lib/types';
import {
  ShoppingBag, Clock, Check, X, Truck, ChevronDown,
  ChevronUp, Filter, Building2, Tag, MapPin
} from 'lucide-react';

const statusConfig: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  pending: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock, label: 'Pending' },
  confirmed: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Check, label: 'Confirmed' },
  processing: { color: 'bg-violet-50 text-violet-700 border-violet-200', icon: Truck, label: 'Processing' },
  delivered: { color: 'bg-green-50 text-green-700 border-green-200', icon: Check, label: 'Delivered' },
  cancelled: { color: 'bg-red-50 text-red-700 border-red-200', icon: X, label: 'Cancelled' },
};

const allStatuses = ['pending', 'confirmed', 'processing', 'delivered', 'cancelled'] as const;

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<string, OrderItem[]>>({});
  const [addressMap, setAddressMap] = useState<Record<string, any>>({});
  const [profileMap, setProfileMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    const orderList = orderData || [];
    setOrders(orderList);

    if (orderList.length > 0) {
      const orderIds = orderList.map((o: any) => o.id);
      const addressIds = orderList.map((o: any) => o.address_id).filter(Boolean) as string[];
      const userIds = [...new Set(orderList.map((o: any) => o.user_id))];

      const [itemsRes, addrRes, profileRes] = await Promise.all([
        supabase.from('order_items').select('*, product:products(name, price, image_url)').in('order_id', orderIds),
        addressIds.length > 0
          ? supabase.from('addresses').select('*').in('id', addressIds)
          : Promise.resolve({ data: [] }),
        supabase.from('profiles').select('user_id, full_name, phone').in('user_id', userIds),
      ]);

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

      const pMap: Record<string, { user_id: string; full_name: string; phone: string }> = {};
      if (profileRes.data) for (const p of profileRes.data) pMap[p.user_id] = p;
      setProfileMap(pMap);
    }
    setLoading(false);
  }

  async function updateStatus(orderId: string, status: string) {
    setUpdating(orderId);
    await supabase.from('orders').update({ status }).eq('id', orderId);

    if (['delivered', 'completed', 'cancelled'].includes(status)) {
      const order = orders.find(o => o.id === orderId);
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

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: status as Order['status'] } : o));
    setUpdating(null);
  }

  const filtered = statusFilter === 'all'
    ? orders
    : orders.filter(o => o.status === statusFilter);

  const calcTotal = (o: Order) =>
    o.total_amount + o.delivery_fee + (o.floor_charge || 0) - (o.discount_amount || 0);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500">{orders.length} total orders</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          >
            <option value="all">All Statuses</option>
            {allStatuses.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const sc = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = sc.icon;
            const isExpanded = expanded === order.id;
            const items = itemsMap[order.id] || [];
            const addr = order.address_id ? addressMap[order.address_id] : null;
            const custProfile = profileMap[order.user_id];

            return (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : order.id)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${sc.color.split(' ')[0]} rounded-xl flex items-center justify-center`}>
                      <StatusIcon className={`w-5 h-5 ${sc.color.split(' ')[1]}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">#{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-gray-400">
                        {custProfile?.full_name || 'Customer'} &middot; {new Date(order.created_at).toLocaleDateString('en-BD', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${sc.color}`}>
                      {sc.label}
                    </span>
                    <span className="font-bold text-gray-900">৳{calcTotal(order).toLocaleString()}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-4">
                    {/* Customer info */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1">Customer</p>
                        <p className="text-sm font-semibold text-gray-900">{custProfile?.full_name || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{custProfile?.phone || ''}</p>
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

                    {/* Items */}
                    {items.length > 0 && (
                      <div className="divide-y divide-gray-50">
                        {items.map(item => (
                          <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                            <span className="text-gray-700">{item.product?.name || 'Item'} &times; {item.quantity}</span>
                            <span className="font-medium">৳{(item.unit_price * item.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Charge breakdown */}
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
                        <span className="font-bold text-blue-600">৳{calcTotal(order).toLocaleString()}</span>
                      </div>
                      {order.notes && (
                        <div className="bg-gray-50 rounded-xl p-3 mt-2 text-sm">
                          <span className="text-gray-400">Notes: </span>
                          <span className="text-gray-700">{order.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Status actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                      {allStatuses.map(s => {
                        const cfg = statusConfig[s];
                        const isActive = order.status === s;
                        return (
                          <button
                            key={s}
                            onClick={() => updateStatus(order.id, s)}
                            disabled={isActive || updating === order.id}
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
