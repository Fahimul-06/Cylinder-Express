import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Flame, Gauge, ShoppingCart } from 'lucide-react';
import { API_BASE_URL } from '../lib/supabase';

type LpgUsage = {
  id: string;
  cylinder_size_kg: number;
  sample_count: number;
  average_interval_days: number;
  confidence: 'low' | 'medium' | 'high';
  last_order_at: string;
  predicted_empty_at: string;
  used_percent: number;
  remaining_percent: number;
  days_remaining: number;
};

export default function CylinderUsagePage() {
  const navigate = useNavigate();
  const [lpgUsage, setLpgUsage] = useState<LpgUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadUsage = async () => {
      try {
        const token = localStorage.getItem('cylinder_express_auth_token');
        const response = await fetch(`${API_BASE_URL}/api/lpg-usage`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const payload = await response.json().catch(() => ({}));
        if (active && response.ok) setLpgUsage(Array.isArray(payload.data) ? payload.data : []);
      } catch {
        if (active) setLpgUsage([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadUsage();
    return () => { active = false; };
  }, []);

  const formatDate = (value: string) => new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(value));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600"
        >
          <ArrowLeft className="w-4 h-4" /> Profile Settings
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cylinder Usage</h1>
            <p className="text-sm text-gray-500">Estimated from your delivered LPG orders</p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center text-sm text-gray-500">
            Calculating cylinder usage...
          </div>
        ) : lpgUsage.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-7 text-center">
            <Flame className="w-12 h-12 mx-auto text-gray-300" />
            <h2 className="mt-4 font-bold text-gray-900">No LPG usage estimate yet</h2>
            <p className="mt-2 text-sm text-gray-500">Your estimate will appear after your first LPG cylinder is delivered.</p>
            <button onClick={() => navigate('/products')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
              <ShoppingCart className="w-4 h-4" /> Browse LPG Cylinders
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {lpgUsage.map((usage) => (
              <div key={usage.id} className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-5 shadow-sm">
                <div className="grid grid-cols-[92px_1fr] gap-5 items-center">
                  <div className="relative mx-auto h-40 w-20">
                    <div className="absolute left-1/2 top-0 h-4 w-9 -translate-x-1/2 rounded-t-md bg-gray-500" />
                    <div className="absolute left-1/2 top-3 h-3 w-12 -translate-x-1/2 rounded-md bg-gray-600" />
                    <div className="absolute inset-x-0 bottom-0 top-5 overflow-hidden rounded-[22px] border-4 border-gray-700 bg-white shadow-inner">
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-orange-600 to-orange-400 transition-all duration-700" style={{ height: `${usage.remaining_percent}%` }} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-lg font-extrabold text-gray-900 drop-shadow-sm">{usage.cylinder_size_kg}kg</span>
                        <span className="text-xs font-bold text-gray-800">{usage.remaining_percent}% left</span>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-orange-700">Current estimated cylinder</p>
                    <h2 className="mt-1 text-xl font-extrabold text-gray-900">{usage.cylinder_size_kg}kg LPG</h2>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-orange-100">
                      <div className="h-full rounded-full bg-orange-500" style={{ width: `${usage.used_percent}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-gray-500">
                      <span>{usage.used_percent}% used</span>
                      <span>{usage.remaining_percent}% remaining</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white p-4 border border-orange-100">
                    <div className="flex items-center gap-2 text-sm text-gray-500"><CalendarDays className="w-4 h-4 text-orange-500" /> Estimated next order</div>
                    <p className="mt-2 font-bold text-gray-900">{formatDate(usage.predicted_empty_at)}</p>
                    <p className="mt-1 text-xs text-gray-500">Approximately {Math.max(0, usage.days_remaining)} days remaining</p>
                  </div>
                  <div className="rounded-xl bg-white p-4 border border-orange-100">
                    <div className="flex items-center gap-2 text-sm text-gray-500"><Gauge className="w-4 h-4 text-orange-500" /> Prediction details</div>
                    <p className="mt-2 font-bold capitalize text-gray-900">{usage.confidence} confidence</p>
                    <p className="mt-1 text-xs text-gray-500">Based on {usage.sample_count} delivered order{usage.sample_count === 1 ? '' : 's'}</p>
                  </div>
                </div>

                <button onClick={() => navigate('/products')} className="mt-4 w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700">
                  Order Cylinder
                </button>
              </div>
            ))}
            <p className="text-center text-xs text-gray-400">Actual usage may vary depending on household size and cooking habits.</p>
          </div>
        )}
      </div>
    </div>
  );
}
