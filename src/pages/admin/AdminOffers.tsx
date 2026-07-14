import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Offer, Product } from '../../lib/types';
import {
  Plus, Pencil, Trash2, X, Check, Search,
  ToggleLeft, ToggleRight, Clock, Percent, BadgeDollarSign, Upload, Image, Loader2
} from 'lucide-react';

type OfferForm = Partial<Pick<Offer,
  'title' | 'description' | 'badge_text' | 'discount_type' | 'discount_value' |
  'code' | 'product_id' | 'category_slug' | 'max_uses_per_customer' | 'bg_from' | 'bg_to' | 'image_url' | 'valid_until' | 'is_active' | 'sort_order'
>>;

const emptyForm: OfferForm = {
  title: '', description: '', badge_text: 'OFFER',
  discount_type: 'percentage', discount_value: 0,
  code: '', product_id: '', category_slug: '', max_uses_per_customer: 1, bg_from: 'from-blue-500', bg_to: 'to-blue-700', image_url: '',
  valid_until: '', is_active: true, sort_order: 0,
};

const gradientOptions = [
  { from: 'from-blue-500', to: 'to-blue-700', label: 'Blue' },
  { from: 'from-blue-600', to: 'to-blue-800', label: 'Blue Dark' },
  { from: 'from-emerald-500', to: 'to-teal-600', label: 'Green-Teal' },
  { from: 'from-blue-500', to: 'to-cyan-600', label: 'Blue-Cyan' },
  { from: 'from-red-500', to: 'to-rose-600', label: 'Red-Rose' },
  { from: 'from-amber-500', to: 'to-orange-600', label: 'Amber-Orange' },
  { from: 'from-violet-500', to: 'to-purple-600', label: 'Violet-Purple' },
  { from: 'from-sky-500', to: 'to-blue-600', label: 'Sky-Blue' },
];

const categoryOptions = [
  { slug: 'lpg-cylinders', label: 'LPG Cylinders' },
  { slug: 'stoves-burners', label: 'Stoves & Burners' },
  { slug: 'accessories', label: 'Accessories' },
  { slug: 'services', label: 'Services' },
];

export default function AdminOffers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [form, setForm] = useState<OfferForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchOffers();
    fetchProducts();
  }, []);

  async function fetchOffers() {
    const { data } = await supabase.from('offers').select('*').order('sort_order');
    setOffers(data || []);
    setLoading(false);
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('is_available', true)
      .order('sort_order');
    setProducts(data || []);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(o: Offer) {
    setEditing(o);
    setForm({
      title: o.title, description: o.description || '', badge_text: o.badge_text,
      discount_type: o.discount_type, discount_value: o.discount_value,
      code: o.code || '', product_id: o.product_id || '', category_slug: o.category_slug || '',
      max_uses_per_customer: o.max_uses_per_customer || 1,
      bg_from: o.bg_from, bg_to: o.bg_to, image_url: o.image_url || '',
      valid_until: o.valid_until ? o.valid_until.slice(0, 16) : '',
      is_active: o.is_active, sort_order: o.sort_order,
    });
    setShowModal(true);
  }


  async function uploadImage(file: File) {
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only JPEG, PNG, WebP, or GIF images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB.');
      return;
    }
    setUploadingImage(true);
    const ext = file.name.split('.').pop();
    const fileName = `offers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, { upsert: false });
    if (error) {
      alert('Offer image upload failed: ' + error.message);
      setUploadingImage(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(data.path);
    setForm(f => ({ ...f, image_url: urlData.publicUrl }));
    setUploadingImage(false);
  }

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadImage(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
    e.target.value = '';
  };

  async function handleSave() {
    if (!form.title || !form.discount_value) return;
    setSaving(true);
    const payload = {
      title: form.title, description: form.description || null,
      badge_text: form.badge_text || 'OFFER',
      discount_type: form.discount_type, discount_value: form.discount_value,
      code: form.product_id ? null : (form.code ? form.code.trim().toUpperCase() : null),
      product_id: form.product_id || null,
      category_slug: form.product_id ? null : (form.category_slug || null),
      max_uses_per_customer: Math.max(1, Number(form.max_uses_per_customer || 1)),
      bg_from: form.bg_from || 'from-blue-500', bg_to: form.bg_to || 'to-blue-700',
      image_url: form.image_url || null,
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
      is_active: form.is_active ?? true, sort_order: form.sort_order || 0,
    };
    if (editing) {
      await supabase.from('offers').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('offers').insert(payload);
    }
    await fetchOffers();
    setShowModal(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this offer?')) return;
    setDeleting(id);
    await supabase.from('offers').delete().eq('id', id);
    setOffers(prev => prev.filter(o => o.id !== id));
    setDeleting(null);
  }

  async function toggleActive(o: Offer) {
    const newVal = !o.is_active;
    await supabase.from('offers').update({ is_active: newVal }).eq('id', o.id);
    setOffers(prev => prev.map(of => of.id === o.id ? { ...of, is_active: newVal } : of));
  }

  const productNameById = (productId?: string | null) => products.find(p => p.id === productId)?.name || '';

  const filtered = offers.filter(o =>
    !search || o.title.toLowerCase().includes(search.toLowerCase()) || (o.code || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Offers</h1>
          <p className="text-sm text-gray-500">{offers.length} offers &middot; {offers.filter(o => o.is_active).length} active</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Offer
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search offers..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
        />
      </div>

      <div className="space-y-2">
        {filtered.map(o => {
          const expired = o.valid_until && new Date(o.valid_until) < new Date();
          return (
            <div key={o.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-stretch">
                {/* Color preview */}
                <div className={`w-3 bg-gradient-to-b ${o.bg_from} ${o.bg_to} flex-shrink-0`} />
                {o.image_url && (
                  <div className="hidden sm:block w-24 h-20 m-3 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 flex-shrink-0">
                    <img src={o.image_url} alt={o.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-gray-900 text-sm truncate">{o.title}</p>
                      {expired && (
                        <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[10px] font-bold">EXPIRED</span>
                      )}
                      {!o.is_active && !expired && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold">INACTIVE</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        {o.discount_type === 'percentage' ? <Percent className="w-3 h-3" /> : <BadgeDollarSign className="w-3 h-3" />}
                        {o.discount_type === 'percentage' ? `${o.discount_value}%` : `৳${o.discount_value}`}
                      </span>
                      {o.code && (
                        <span className="font-mono font-bold tracking-wider text-gray-600">{o.code}</span>
                      )}
                      {o.product_id && (
                        <span className="text-blue-600 font-medium">Product: {productNameById(o.product_id) || 'Selected product'}</span>
                      )}
                      {o.max_uses_per_customer && (
                        <span>Limit/customer: {o.max_uses_per_customer}</span>
                      )}
                      {o.valid_until && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {expired ? 'Expired' : `Until ${new Date(o.valid_until).toLocaleDateString('en-BD', { day: 'numeric', month: 'short' })}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(o)}
                      className={`p-1.5 rounded-lg transition-colors ${o.is_active ? 'text-green-500 hover:bg-green-50' : 'text-gray-300 hover:bg-gray-50'}`}
                    >
                      {o.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => openEdit(o)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(o.id)} disabled={deleting === o.id} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No offers found</div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{editing ? 'Edit Offer' : 'Add Offer'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Offer Picture</label>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'}`}
                >
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" onChange={handleFileChange} className="hidden" />
                  {form.image_url ? (
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-24 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                        <img src={form.image_url} alt="Offer preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">Offer picture added</p>
                        <p className="text-xs text-gray-400 mt-0.5">Click or drag to replace</p>
                        {uploadingImage && <div className="flex items-center gap-1 text-blue-600 text-xs mt-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</div>}
                      </div>
                      <button type="button" onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, image_url: '' })); }} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-7 px-4 text-center">
                      {uploadingImage ? (
                        <>
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                          <p className="text-sm text-blue-600 font-medium">Uploading picture...</p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3"><Upload className="w-6 h-6 text-blue-500" /></div>
                          <p className="text-sm font-medium text-gray-700">Click to choose offer picture</p>
                          <p className="text-xs text-gray-400 mt-1">or drag & drop here</p>
                          <p className="text-xs text-gray-300 mt-1">JPEG, PNG, WebP, GIF · Max 5MB</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1.5"><Image className="w-3.5 h-3.5 text-gray-400" /><span className="text-xs text-gray-400">Or paste image URL</span></div>
                  <input value={form.image_url || ''} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Badge Text</label>
                  <input value={form.badge_text || ''} onChange={e => setForm(f => ({ ...f, badge_text: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
                  <select value={form.discount_type || 'percentage'} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as 'percentage' | 'flat' }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600">
                    <option value="percentage">Percentage</option>
                    <option value="flat">Flat (৳)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
                  <input type="number" value={form.discount_value || 0} onChange={e => setForm(f => ({ ...f, discount_value: Number(e.target.value) }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
                  <input
                    value={form.product_id ? '' : (form.code || '')}
                    disabled={Boolean(form.product_id)}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder={form.product_id ? 'Auto sale - no promo code needed' : 'SPECIAL10'}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">Promo codes are only for Special Offers. Product sale discounts apply automatically.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.product_id ? '' : (form.category_slug || '')}
                    disabled={Boolean(form.product_id)}
                    onChange={e => setForm(f => ({ ...f, category_slug: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <option value="">All categories</option>
                    {categoryOptions.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specific Product Offer</label>
                <select
                  value={form.product_id || ''}
                  onChange={e => setForm(f => ({
                    ...f,
                    product_id: e.target.value,
                    code: e.target.value ? '' : f.code,
                    category_slug: e.target.value ? '' : f.category_slug,
                  }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  <option value="">No specific product - category/general offer</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} · ৳{product.price.toLocaleString()}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Select a product here for an automatic sale price. Customer will not need any promo code.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usage limit per customer</label>
                <input
                  type="number"
                  min={1}
                  value={form.max_uses_per_customer || 1}
                  onChange={e => setForm(f => ({ ...f, max_uses_per_customer: Math.max(1, Number(e.target.value || 1)) }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
                <p className="mt-1 text-xs text-gray-500">Used only for promo-code Special Offers. Product sale offers are automatic.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gradient Color</label>
                <div className="grid grid-cols-4 gap-2">
                  {gradientOptions.map(g => (
                    <button
                      key={g.label}
                      onClick={() => setForm(f => ({ ...f, bg_from: g.from, bg_to: g.to }))}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                        form.bg_from === g.from && form.bg_to === g.to
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className={`w-full h-6 bg-gradient-to-r ${g.from} ${g.to} rounded-lg`} />
                      <span className="text-[10px] text-gray-500">{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                  <input type="datetime-local" value={form.valid_until || ''} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input type="number" value={form.sort_order || 0} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                Active
              </label>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title || !form.discount_value} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2">
                <Check className="w-4 h-4" /> {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
