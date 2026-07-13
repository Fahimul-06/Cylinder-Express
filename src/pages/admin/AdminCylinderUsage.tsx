import { useEffect, useState } from 'react';
import { BellRing, CalendarDays, Check, Cylinder, Pencil, Search, X } from 'lucide-react';
import { apiClient } from '../../lib/supabase';

type Usage = {
  id: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  cylinder_size_kg: number;
  predicted_empty_at: string;
  system_predicted_empty_at?: string;
  days_remaining: number;
  confidence: string;
  sample_count: number;
  is_admin_adjusted?: boolean;
};

const toInputDate = (value: string) => {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export default function AdminCylinderUsage() {
  const [items, setItems] = useState<Usage[]>([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const r = await apiClient<{ data: Usage[] }>('/api/admin/lpg-usage');
      setItems(r.data || []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not load estimates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const notify = async (item: Usage) => {
    try {
      await apiClient('/api/admin/lpg-usage/notify', { method: 'POST', body: JSON.stringify({ usage_id: item.id }) });
      setMessage(`Notification sent to ${item.customer_name}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Notification failed.');
    }
  };

  const beginEdit = (item: Usage) => {
    setEditingId(item.id);
    setEditDate(toInputDate(item.predicted_empty_at));
    setMessage('');
  };

  const saveDate = async (item: Usage) => {
    if (!editDate) return;
    setSaving(true);
    try {
      await apiClient(`/api/admin/lpg-usage/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ predicted_empty_at: editDate }),
      });
      setEditingId(null);
      setMessage(`Estimated finish date updated for ${item.customer_name}.`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not update the date.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = items.filter((i) => `${i.customer_name} ${i.customer_phone} ${i.cylinder_size_kg}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Customer Cylinder Usage</h1>
          <p className="text-sm text-gray-500">Review, adjust estimated finish dates, and notify customers.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer" className="border rounded-xl pl-9 pr-3 py-2.5 text-sm" />
        </div>
      </div>

      {message && <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-xl text-sm">{message}</div>}

      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-4">Customer</th>
                <th className="text-left p-4">Cylinder</th>
                <th className="text-left p-4">Estimated finish date</th>
                <th className="text-left p-4">Remaining</th>
                <th className="text-left p-4">Confidence</th>
                <th className="text-right p-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No cylinder usage estimates found.</td></tr>
              ) : filtered.map((item) => (
                <tr key={item.id} className="border-t align-top">
                  <td className="p-4"><p className="font-semibold">{item.customer_name}</p><p className="text-xs text-gray-500">{item.customer_phone}</p></td>
                  <td className="p-4"><span className="inline-flex items-center gap-2"><Cylinder className="w-4 h-4 text-blue-600" />{item.cylinder_size_kg}kg</span></td>
                  <td className="p-4 min-w-[245px]">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-2">
                        <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="border rounded-lg px-2.5 py-2" />
                        <button disabled={saving} onClick={() => saveDate(item)} className="p-2 rounded-lg bg-green-600 text-white disabled:opacity-50" title="Save"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-2 rounded-lg bg-gray-100 text-gray-600" title="Cancel"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 font-medium">
                          <CalendarDays className="w-4 h-4 text-gray-400" />
                          {new Date(item.predicted_empty_at).toLocaleDateString()}
                          <button onClick={() => beginEdit(item)} className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50" title="Change estimated date"><Pencil className="w-4 h-4" /></button>
                        </div>
                        {item.is_admin_adjusted && <p className="text-xs text-amber-600 mt-1">Adjusted by Administration Head</p>}
                      </div>
                    )}
                  </td>
                  <td className={`p-4 font-semibold ${item.days_remaining <= 3 ? 'text-red-600' : item.days_remaining <= 7 ? 'text-amber-600' : 'text-green-600'}`}>{item.days_remaining <= 0 ? 'Due/overdue' : `${item.days_remaining} days`}</td>
                  <td className="p-4 capitalize">{item.confidence} ({item.sample_count} orders)</td>
                  <td className="p-4 text-right"><button onClick={() => notify(item)} className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700"><BellRing className="w-4 h-4" />Notify</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
