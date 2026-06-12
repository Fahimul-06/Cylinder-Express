import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, Category } from '../../lib/types';
import {
  Plus, Pencil, Trash2, X, Check, Search,
  Star, ToggleLeft, ToggleRight, Upload, Image, Loader2, Package
} from 'lucide-react';

type ProductForm = Partial<Pick<Product,
  'name' | 'description' | 'price' | 'image_url' | 'type' | 'size' |
  'unit' | 'is_bestseller' | 'is_available' | 'sort_order' | 'category_id' | 'company_name'
>>;

const LPG_COMPANIES = [
  'Bashundhara LPG',
  'Omera LPG',
  'Jamuna LPG',
  'Beximco LPG',
  'Petromax LPG',
  'Fresh LPG',
  'Totalgaz LPG',
  'LAUGFS Gas',
  'Navana LPG',
  'BM LP Gas',
  'Universal LPG',
  'Orion LPG',
  'G-Gas LPG',
  'Delta LPG',
  'Sena LPG',
];

const emptyForm: ProductForm = {
  name: '', description: '', price: 0, image_url: '', type: 'new',
  size: '', unit: 'piece', is_bestseller: false, is_available: true,
  sort_order: 0, category_id: '', company_name: '',
};

function getProductSearchText(product: Product) {
  return [
    product.name,
    product.company_name,
    product.description,
    product.size,
    product.type,
    product.unit,
    product.category?.name,
  ].filter(Boolean).join(' ').toLowerCase();
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionSearch, setSectionSearch] = useState<Record<string, string>>({});
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

  const selectedCategory = categories.find(c => c.id === form.category_id);
  const isLpgCylinder = selectedCategory?.slug === 'lpg-cylinders';

  function generateLpgName(next: Partial<ProductForm> = {}) {
    const company = String(next.company_name ?? form.company_name ?? '').trim();
    const size = String(next.size ?? form.size ?? '').trim();
    const type = next.type ?? form.type ?? 'new';
    if (!company) return String(next.name ?? form.name ?? '');
    const suffix = type === 'refill' ? 'Refill' : 'New Cylinder';
    return [company, size, suffix].filter(Boolean).join(' ');
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name, description: p.description || '', price: p.price,
      image_url: p.image_url || '', type: p.type, size: p.size || '',
      unit: p.unit, is_bestseller: p.is_bestseller, is_available: p.is_available,
      sort_order: p.sort_order, category_id: p.category_id, company_name: p.company_name || '',
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

  function handleCategoryChange(categoryId: string) {
    const category = categories.find(c => c.id === categoryId);
    const isLpg = category?.slug === 'lpg-cylinders';
    setForm(f => ({
      ...f,
      category_id: categoryId,
      company_name: isLpg ? (f.company_name || '') : '',
      unit: isLpg ? 'cylinder' : category?.slug === 'services' ? 'service' : f.unit || 'piece',
      type: category?.slug === 'services' ? 'service' : f.type || 'new',
    }));
  }

  function handleCompanyChange(company: string) {
    setForm(f => ({
      ...f,
      company_name: company,
      name: generateLpgName({ company_name: company }),
    }));
  }

  function handleTypeChange(type: Product['type']) {
    setForm(f => {
      const next = { ...f, type };
      if (isLpgCylinder && f.company_name) next.name = generateLpgName({ type });
      if (type === 'service') next.unit = 'service';
      return next;
    });
  }

  function handleSizeChange(size: string) {
    setForm(f => {
      const next = { ...f, size };
      if (isLpgCylinder && f.company_name) next.name = generateLpgName({ size });
      return next;
    });
  }

  async function handleSave() {
    if (!form.name || !form.price || !form.category_id) return;
    if (isLpgCylinder && !form.company_name) {
      alert('Please select LPG cylinder company name.');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name, description: form.description || null,
      price: form.price, image_url: form.image_url || null,
      type: form.type, size: form.size || null, unit: form.unit || 'piece',
      company_name: isLpgCylinder ? form.company_name || null : null,
      is_bestseller: form.is_bestseller, is_available: form.is_available,
      sort_order: form.sort_order || 0, category_id: form.category_id,
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

  const typeLabels: Record<string, string> = { new: 'New', refill: 'Refill', service: 'Service' };
  const typeColors: Record<string, string> = {
    new: 'bg-blue-50 text-blue-700', refill: 'bg-emerald-50 text-emerald-700',
    service: 'bg-amber-50 text-amber-700',
  };

  const categorySections = categories.map(category => {
    const query = (sectionSearch[category.id] || '').toLowerCase().trim();
    const items = products.filter(product => {
      if (product.category_id !== category.id) return false;
      if (!query) return true;
      return getProductSearchText(product).includes(query);
    });
    return { category, query, items };
  });

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products & Services</h1>
          <p className="text-sm text-gray-500">{products.length} products grouped by business type</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Product / Service
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {categorySections.map(({ category }) => {
          const count = products.filter(product => product.category_id === category.id).length;
          return (
            <div key={category.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{category.name}</p>
                  <p className="text-xs text-gray-400">{count} items</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {categorySections.map(({ category, items }) => (
        <section key={category.id} className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{category.name}</h2>
                <p className="text-xs text-gray-500">{category.description || 'Manage products and service items'}</p>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={sectionSearch[category.id] || ''}
                  onChange={e => setSectionSearch(prev => ({ ...prev, [category.id]: e.target.value }))}
                  placeholder={`Search ${category.name.toLowerCase()}...`}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {items.map(p => (
              <div key={p.id} className="p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
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
                    {p.company_name && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700">
                        {p.company_name}
                      </span>
                    )}
                    {p.is_bestseller && <Star className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />}
                  </div>
                  <p className="text-xs text-gray-400">
                    {p.size || 'No size'} &middot; {p.unit || 'piece'} &middot; ৳{p.price.toLocaleString()}
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
                  <button
                    onClick={() => openEdit(p)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deleting === p.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">No items found in this section</div>
            )}
          </div>
        </section>
      ))}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{editing ? 'Edit Product / Service' : 'Add Product / Service'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select value={form.category_id || ''} onChange={e => handleCategoryChange(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600">
                    <option value="">Select product/service type...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select value={form.type || 'new'} onChange={e => handleTypeChange(e.target.value as Product['type'])} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600">
                    <option value="new">New</option>
                    <option value="refill">Refill</option>
                    <option value="service">Service</option>
                  </select>
                </div>
              </div>

              {isLpgCylinder && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">LPG Cylinder Company *</label>
                    <select value={form.company_name || ''} onChange={e => handleCompanyChange(e.target.value)} className="w-full px-4 py-2.5 border border-blue-200 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600">
                      <option value="">Select company...</option>
                      {LPG_COMPANIES.map(company => <option key={company} value={company}>{company}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cylinder Size</label>
                    <select value={form.size || ''} onChange={e => handleSizeChange(e.target.value)} className="w-full px-4 py-2.5 border border-blue-200 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600">
                      <option value="">Select size...</option>
                      <option value="5kg">5kg</option>
                      <option value="12kg">12kg</option>
                      <option value="12.5kg">12.5kg</option>
                      <option value="15kg">15kg</option>
                      <option value="20kg">20kg</option>
                      <option value="35kg">35kg</option>
                      <option value="45kg">45kg</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Product or service name" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                {isLpgCylinder && <p className="text-xs text-gray-400 mt-1">Selecting company, size, and type will auto-fill the cylinder name. You can still edit it.</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                  <input type="number" value={form.price || 0} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                </div>
                {!isLpgCylinder && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                    <input value={form.size || ''} onChange={e => handleSizeChange(e.target.value)} placeholder="1 meter, double burner..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input value={form.unit || 'piece'} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input type="number" value={form.sort_order || 0} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                </div>
              </div>

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
                  className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer ${
                    dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {form.image_url ? (
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                        <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">Image uploaded</p>
                        <p className="text-xs text-gray-400 mt-0.5">Click or drag to replace</p>
                        {uploadingImage && (
                          <div className="flex items-center gap-1 text-blue-600 text-xs mt-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, image_url: '' })); }}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                      >
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
                          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                            <Upload className="w-6 h-6 text-blue-500" />
                          </div>
                          <p className="text-sm font-medium text-gray-700">{dragOver ? 'Drop image here' : 'Click to choose file'}</p>
                          <p className="text-xs text-gray-400 mt-1">or drag & drop here</p>
                          <p className="text-xs text-gray-300 mt-1">JPEG, PNG, WebP, GIF · Max 5MB</p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Image className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs text-gray-400">Or paste image URL</span>
                  </div>
                  <input
                    value={form.image_url || ''}
                    onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_bestseller || false} onChange={e => setForm(f => ({ ...f, is_bestseller: e.target.checked }))} className="rounded" />
                  Bestseller
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_available !== false} onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))} className="rounded" />
                  Available
                </label>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || uploadingImage || !form.name || !form.price || !form.category_id || (isLpgCylinder && !form.company_name)}
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
