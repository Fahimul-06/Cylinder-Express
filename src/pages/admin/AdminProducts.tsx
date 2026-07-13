import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, Category } from '../../lib/types';
import { LPG_COMPANIES, LPG_SIZES } from '../../lib/productOptions';
import {
  Plus, Pencil, Trash2, X, Check, Search,
  Star, ToggleLeft, ToggleRight, Upload, Image, Loader2, Flame, Wrench, Package
} from 'lucide-react';

type ProductForm = Partial<Pick<Product,
  'name' | 'description' | 'price' | 'gas_price' | 'bottle_price' | 'image_url' | 'type' | 'company_name' | 'size' |
  'unit' | 'is_bestseller' | 'is_available' |
  'sort_order' | 'category_id'
>>;

const emptyForm: ProductForm = {
  name: '', description: '', price: 0, gas_price: 0, bottle_price: 0, image_url: '', type: 'new',
  company_name: '', size: '', unit: 'piece',
  is_bestseller: false, is_available: true, sort_order: 0, category_id: '',
};

const typeLabels: Record<string, string> = { new: 'New Product', refill: 'Cylinder Refill', service: 'Service' };
const typeColors: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700', refill: 'bg-emerald-50 text-emerald-700', service: 'bg-amber-50 text-amber-700',
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => setCategories(data || []));
  }, []);

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .order('sort_order');
    setProducts(data || []);
    setLoading(false);
  }

  const lpgCategory = categories.find(c => c.slug === 'lpg-cylinders');
  const selectedCategory = categories.find(c => c.id === form.category_id);
  const isLpgCylinderForm = selectedCategory?.slug === 'lpg-cylinders';

  const groupedProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = products.filter(p => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && p.category?.slug !== categoryFilter) return false;
      if (!q) return true;
      return [p.name, p.description, p.category?.name, p.type, p.company_name, p.size]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q));
    });
    return categories
      .map(category => ({ category, items: filtered.filter(p => p.category?.slug === category.slug) }))
      .filter(group => group.items.length > 0);
  }, [products, categories, search, typeFilter, categoryFilter]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, category_id: lpgCategory?.id || '' });
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || '',
      price: p.price,
      gas_price: p.gas_price ?? p.price,
      bottle_price: p.bottle_price ?? 0,
      image_url: p.image_url || '',
      type: p.type,
      company_name: p.company_name || '',
      size: p.size || '',
      unit: p.unit,
      is_bestseller: p.is_bestseller,
      is_available: p.is_available,
      sort_order: p.sort_order,
      category_id: p.category_id,
    });
    setShowModal(true);
  }

  function applyLpgName(next: Partial<ProductForm>) {
    const updated = { ...form, ...next };
    const isLpg = categories.find(c => c.id === updated.category_id)?.slug === 'lpg-cylinders';
    if (!isLpg || !updated.company_name || !updated.size) return updated;
    return { ...updated, type: 'new' as const, name: `${updated.company_name} ${updated.size} LPG Cylinder`, unit: 'cylinder' };
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
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, { upsert: false });
    if (error) {
      alert('Upload failed: ' + error.message);
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
    const effectivePrice = isLpgCylinderForm ? Number(form.gas_price || 0) : Number(form.price || 0);
    if (!form.name || effectivePrice <= 0 || !form.category_id) return;
    if (isLpgCylinderForm && (!form.company_name || !form.size)) {
      alert('Please select LPG company name and cylinder size.');
      return;
    }

    if (isLpgCylinderForm) {
      const duplicate = products.find(p =>
        p.id !== editing?.id &&
        p.category_id === form.category_id &&
        p.company_name === form.company_name &&
        p.size === form.size
      );

      if (duplicate) {
        alert(`This LPG cylinder already exists: ${duplicate.name}. Edit the same product to manage both refill and new-cylinder prices.`);
        return;
      }
    }

    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description || null,
      price: effectivePrice,
      gas_price: isLpgCylinderForm ? Number(form.gas_price || 0) : null,
      bottle_price: isLpgCylinderForm ? Number(form.bottle_price || 0) : null,
      image_url: form.image_url || null,
      type: form.type,
      company_name: isLpgCylinderForm ? form.company_name || null : null,
      size: form.size || null,
      valve_size: isLpgCylinderForm ? '22mm' : null,
      valve_connection: isLpgCylinderForm ? 'Pin' : null,
      unit: form.unit || (isLpgCylinderForm ? 'cylinder' : 'piece'),
      is_bestseller: form.is_bestseller,
      is_available: form.is_available,
      sort_order: form.sort_order || 0,
      category_id: form.category_id,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await supabase.from('products').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('products').insert(payload);
    }
    await fetchProducts();
    setShowModal(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product?')) return;
    setDeleting(id);
    await supabase.from('products').delete().eq('id', id);
    setProducts(prev => prev.filter(p => p.id !== id));
    setDeleting(null);
  }

  async function toggleAvailable(p: Product) {
    const newVal = !p.is_available;
    await supabase.from('products').update({ is_available: newVal }).eq('id', p.id);
    setProducts(prev => prev.map(pr => pr.id === p.id ? { ...pr, is_available: newVal } : pr));
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Products & Services</h1>
          <p className="text-sm text-gray-500">{products.length} catalog items</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      <div className="grid md:grid-cols-[1fr_180px_220px] gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by product, company, size, valve, service..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
        >
          <option value="all">All Types</option>
          <option value="new">New Product</option>
          <option value="refill">Cylinder Refill</option>
          <option value="service">Service</option>
        </select>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
        >
          <option value="all">All Product Boxes</option>
          {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
      </div>

      <div className="space-y-5">
        {groupedProducts.map(({ category, items }) => {
          const Icon = category.slug === 'lpg-cylinders' ? Flame : category.slug === 'services' ? Wrench : Package;
          return (
            <section key={category.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-blue-600" />
                  <h2 className="font-bold text-gray-900">{category.name}</h2>
                </div>
                <span className="text-xs text-gray-500">{items.length} items</span>
              </div>
              <div className="divide-y divide-gray-100">
                {items.map(p => (
                  <div key={p.id} className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                      <img
                        src={p.image_url || 'https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=100'}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <p className="font-semibold text-gray-900 text-sm truncate">{p.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${typeColors[p.type]}`}>
                          {typeLabels[p.type]}
                        </span>
                        {p.is_bestseller && <Star className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />}
                      </div>
                      <p className="text-xs text-gray-400">
                        {[p.company_name, p.size].filter(Boolean).join(' · ') || 'General item'} · {p.category?.slug === 'lpg-cylinders' ? `Gas ৳${Number(p.gas_price ?? p.price).toLocaleString()} · Bottle ৳${Number(p.bottle_price ?? 0).toLocaleString()} · New ৳${(Number(p.gas_price ?? p.price) + Number(p.bottle_price ?? 0)).toLocaleString()}` : `৳${p.price.toLocaleString()}`} 
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleAvailable(p)}
                        className={`p-1.5 rounded-lg transition-colors ${p.is_available ? 'text-green-500 hover:bg-green-50' : 'text-gray-300 hover:bg-gray-50'}`}
                        title={p.is_available ? 'Available' : 'Unavailable'}
                      >
                        {p.is_available ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deleting === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {groupedProducts.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500">
            No matching product or service found.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-bold text-gray-900">{editing ? 'Edit Product / Service' : 'Add Product / Service'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category / Product Box *</label>
                  <select
                    value={form.category_id || ''}
                    onChange={e => setForm(f => applyLpgName({ ...f, category_id: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  >
                    <option value="">Select...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  {isLpgCylinderForm ? (
                    <div className="w-full px-4 py-2.5 border border-blue-100 bg-blue-50 rounded-xl text-sm font-semibold text-blue-800">
                      LPG Cylinder — New/Refill selected by customer
                    </div>
                  ) : (
                    <select
                      value={form.type || 'new'}
                      onChange={e => setForm(f => ({ ...f, type: e.target.value as Product['type'] }))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    >
                      <option value="new">Product</option>
                      <option value="service">Service</option>
                    </select>
                  )}
                </div>
              </div>

              {isLpgCylinderForm && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-blue-900 text-sm">LPG Cylinder Details</h4>
                      <p className="text-xs text-blue-600">Create one product for each brand and size. Customers choose New Cylinder or Refill, valve type, and valve size on the product page.</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">LPG Company Name *</label>
                      <select
                        value={form.company_name || ''}
                        onChange={e => setForm(f => applyLpgName({ ...f, company_name: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      >
                        <option value="">Select company...</option>
                        {LPG_COMPANIES.map(company => <option key={company} value={company}>{company}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cylinder Size *</label>
                      <select
                        value={form.size || ''}
                        onChange={e => setForm(f => applyLpgName({ ...f, size: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      >
                        <option value="">Select size...</option>
                        {LPG_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2 rounded-xl bg-white border border-blue-100 p-3">
                      <p className="text-sm font-semibold text-blue-900">Valve selection is not uploaded separately.</p>
                      <p className="text-xs text-blue-700 mt-1">Available customer choices: Paul / Pin and 22mm / 20mm. If no valve details are provided, the defaults are Pin and 22mm.</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
              </div>

              {isLpgCylinderForm ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gas / Refill Price *</label>
                      <input
                        type="number"
                        min="0"
                        value={form.gas_price || 0}
                        onChange={e => setForm(f => ({ ...f, gas_price: Number(e.target.value), price: Number(e.target.value) }))}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      />
                      <p className="mt-1 text-xs text-gray-500">Customer refill price. This includes gas only.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Empty Bottle Price *</label>
                      <input
                        type="number"
                        min="0"
                        value={form.bottle_price || 0}
                        onChange={e => setForm(f => ({ ...f, bottle_price: Number(e.target.value) }))}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      />
                      <p className="mt-1 text-xs text-gray-500">Added only when customer selects New Cylinder.</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-blue-800">New cylinder total</span>
                      <strong className="text-blue-950">৳{(Number(form.gas_price || 0) + Number(form.bottle_price || 0)).toLocaleString()}</strong>
                    </div>
                    <p className="mt-1 text-xs text-blue-700">Gas price + bottle price = new cylinder price</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                    <input type="number" value={form.price || 0} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Size / Variant</label>
                    <input value={form.size || ''} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Image</label>
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
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                        <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">Image uploaded</p>
                        <p className="text-xs text-gray-400 mt-0.5">Click or drag to replace</p>
                        {uploadingImage && <div className="flex items-center gap-1 text-blue-600 text-xs mt-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</div>}
                      </div>
                      <button type="button" onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, image_url: '' })); }} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                      {uploadingImage ? (
                        <>
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                          <p className="text-sm text-blue-600 font-medium">Uploading image...</p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3"><Upload className="w-6 h-6 text-blue-500" /></div>
                          <p className="text-sm font-medium text-gray-700">{dragOver ? 'Drop image here' : 'Click to choose file'}</p>
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
                {!isLpgCylinderForm && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                    <input value={form.unit || 'piece'} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input type="number" value={form.sort_order || 0} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                </div>
                <div className="flex flex-col justify-end gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.is_bestseller || false} onChange={e => setForm(f => ({ ...f, is_bestseller: e.target.checked }))} className="rounded" />Bestseller</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.is_available !== false} onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))} className="rounded" />Available</label>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3 justify-end sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || uploadingImage || !form.name || !(isLpgCylinderForm ? form.gas_price : form.price) || !form.category_id}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
