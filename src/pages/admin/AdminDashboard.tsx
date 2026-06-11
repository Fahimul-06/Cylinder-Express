import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ShoppingBag, Package, Tag, Users, DollarSign,
  TrendingUp, Clock, CheckCircle
} from 'lucide-react';

interface Stats {
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  totalProducts: number;
  activeOffers: number;
  totalUsers: number;
  todayOrders: number;
  deliveredOrders: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0, pendingOrders: 0, totalRevenue: 0,
    totalProducts: 0, activeOffers: 0, totalUsers: 0,
    todayOrders: 0, deliveredOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [
        ordersRes, productsRes, offersRes, profilesRes,
        todayRes, recentRes,
      ] = await Promise.all([
        supabase.from('orders').select('total_amount, delivery_fee, floor_charge, discount_amount, status, created_at'),
        supabase.from('products').select('id', { count: 'exact' }).eq('is_available', true),
        supabase.from('offers').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('orders').select('id').gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from('orders').select('id, total_amount, delivery_fee, floor_charge, discount_amount, status, created_at').order('created_at', { ascending: false }).limit(5),
      ]);

      const orders = ordersRes.data || [];
      const totalOrders = orders.length;
      const pendingOrders = orders.filter(o => o.status === 'pending').length;
      const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
      const totalRevenue = orders.reduce((s, o) =>
        s + o.total_amount + (o.delivery_fee || 0) + (o.floor_charge || 0) - (o.discount_amount || 0), 0);

      setStats({
        totalOrders,
        pendingOrders,
        totalRevenue,
        totalProducts: productsRes.count || 0,
        activeOffers: offersRes.count || 0,
        totalUsers: profilesRes.count || 0,
        todayOrders: (todayRes.data || []).length,
        deliveredOrders,
      });
      setRecentOrders(recentRes.data || []);
      setLoading(false);
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Revenue', value: `৳${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'bg-emerald-50 text-emerald-600', iconBg: 'bg-emerald-100' },
    { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingBag, color: 'bg-blue-50 text-blue-600', iconBg: 'bg-blue-100' },
    { label: 'Pending', value: stats.pendingOrders, icon: Clock, color: 'bg-amber-50 text-amber-600', iconBg: 'bg-amber-100' },
    { label: 'Delivered', value: stats.deliveredOrders, icon: CheckCircle, color: 'bg-green-50 text-green-600', iconBg: 'bg-green-100' },
    { label: 'Today', value: stats.todayOrders, icon: TrendingUp, color: 'bg-violet-50 text-violet-600', iconBg: 'bg-violet-100' },
    { label: 'Products', value: stats.totalProducts, icon: Package, color: 'bg-blue-50 text-blue-600', iconBg: 'bg-blue-100' },
    { label: 'Active Offers', value: stats.activeOffers, icon: Tag, color: 'bg-rose-50 text-rose-600', iconBg: 'bg-rose-100' },
    { label: 'Users', value: stats.totalUsers, icon: Users, color: 'bg-cyan-50 text-cyan-600', iconBg: 'bg-cyan-100' },
  ];

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    confirmed: 'bg-blue-50 text-blue-700',
    processing: 'bg-violet-50 text-violet-700',
    delivered: 'bg-green-50 text-green-700',
    cancelled: 'bg-red-50 text-red-700',
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your Cylinder Express business</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map(({ label, value, icon: Icon, color, iconBg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color.split(' ')[1]}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Recent Orders</h2>
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No orders yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentOrders.map(order => (
              <div key={order.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">#{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[order.status] || 'bg-gray-100 text-gray-600'}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                  <span className="font-bold text-sm text-gray-900">
                    ৳{(order.total_amount + (order.delivery_fee || 0) + (order.floor_charge || 0) - (order.discount_amount || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
