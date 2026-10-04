import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PartnerBrand } from '../../lib/types';
import { ArrowDown, ArrowUp, Image as ImageIcon, Loader2, Pencil, Plus, ToggleLeft, ToggleRight, Trash2, Upload, X } from 'lucide-react';

type BrandForm = { name: string; logo_url: string; sort_order: number; is_active: boolean };
const emptyForm: BrandForm = { name: '', logo_url: '', sort_order: 0, is_active: true };

export default function AdminPartnerBrands() {
  const [brands, setBrands] = useState<PartnerBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PartnerBrand | null>(null);
  const [form, setForm] = useState<BrandForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchBrands(); }, []);

  async function fetchBrands() {
    const { data } = await supabase.from('partner_brands').select('*').order('sort_order');
    setBrands(data || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, sort_order: brands.length + 1 });
    setShowModal(true);
  }

  function openEdit(brand: PartnerBrand) {
    setEditing(brand);
    setForm({ name: brand.name, logo_url: brand.logo_url, sort_order: brand.sort_order || 0, is_active: brand.is_active !== false });
    setShowModal(true);
  }

  async function uploadLogo(file: File) {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) return alert('Only JPG, PNG, WebP, or SVG logos are allowed.');
    if (file.size > 4 * 1024 * 1024) return alert('Brand logo must be under 4MB.');
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `partner-brands/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('product-images').upload(path, file, { upsert: false });
      if (error || !data) return alert('Logo upload failed: ' + (error?.message || 'Unknown error'));
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(data.path);
      setForm(v => ({ ...v, logo_url: urlData.publicUrl }));
    } finally { setUploading(false); }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0]; if (file) uploadLogo(file);
  }, []);

  async function save() {
    if (!form.name.trim()) return alert('Please enter the partner brand name.');
    if (!form.logo_url) return alert('Please upload the partner brand logo.');
    setSaving(true);
    const payload = { name: form.name.trim(), logo_url: form.logo_url, sort_order: Number(form.sort_order || 0), is_active: form.is_active !== false };
    const result = editing
      ? await supabase.from('partner_brands').update(payload).eq('id', editing.id)
      : await supabase.from('partner_brands').insert(payload);
    if (result.error) alert(result.error.message);
    else { await fetchBrands(); setShowModal(false); }
    setSaving(false);
  }

  async function remove(brand: PartnerBrand) {
    if (!confirm(`Delete partner brand “${brand.name}”?`)) return;
    await supabase.from('partner_brands').delete().eq('id', brand.id);
    setBrands(v => v.filter(x => x.id !== brand.id));
  }

  async function toggle(brand: PartnerBrand) {
    const is_active = !brand.is_active;
    await supabase.from('partner_brands').update({ is_active }).eq('id', brand.id);
    setBrands(v => v.map(x => x.id === brand.id ? { ...x, is_active } : x));
  }

  async function move(brand: PartnerBrand, dir: -1 | 1) {
    const index = brands.findIndex(x => x.id === brand.id);
    const target = brands[index + dir]; if (!target) return;
    const a = brand.sort_order || index + 1, b = target.sort_order || index + dir + 1;
    await Promise.all([
      supabase.from('partner_brands').update({ sort_order: b }).eq('id', brand.id),
      supabase.from('partner_brands').update({ sort_order: a }).eq('id', target.id),
    ]);
    await fetchBrands();
  }

  if (loading) return <div className="p-6 animate-pulse"><div className="h-8 w-52 bg-gray-200 rounded" /></div>;

  return <div className="p-4 sm:p-6 lg:p-8 space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-gray-900">Partner Brands</h1><p className="text-sm text-gray-500">Upload brand logos and names shown in the homepage slider.</p></div>
      <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"><Plus className="w-4 h-4" /> Add Partner Brand</button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {brands.map((brand, index) => <div key={brand.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-4">
        <div className="w-20 h-20 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0"><img src={brand.logo_url} alt={brand.name} className="max-w-full max-h-full object-contain p-2" /></div>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="font-semibold text-gray-900 truncate">{brand.name}</h3>{!brand.is_active && <span className="text-[9px] font-bold rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">INACTIVE</span>}</div><p className="text-xs text-gray-400 mt-1">Order: {brand.sort_order || index + 1}</p>
          <div className="flex items-center gap-1 mt-3">
            <button onClick={() => move(brand,-1)} disabled={index===0} className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30"><ArrowUp className="w-4 h-4"/></button>
            <button onClick={() => move(brand,1)} disabled={index===brands.length-1} className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30"><ArrowDown className="w-4 h-4"/></button>
            <button onClick={() => toggle(brand)} className={`p-1.5 rounded-lg ${brand.is_active?'text-green-500 hover:bg-green-50':'text-gray-300 hover:bg-gray-50'}`}>{brand.is_active?<ToggleRight className="w-5 h-5"/>:<ToggleLeft className="w-5 h-5"/>}</button>
            <button onClick={() => openEdit(brand)} className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600"><Pencil className="w-4 h-4"/></button>
            <button onClick={() => remove(brand)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
          </div>
        </div>
      </div>)}
      {brands.length===0 && <div className="md:col-span-2 xl:col-span-3 bg-white border border-gray-100 rounded-2xl py-14 text-center"><ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-3"/><p className="font-semibold text-gray-700">No partner brands yet</p><p className="text-sm text-gray-400">Add a name and logo to show it on the homepage.</p></div>}
    </div>

    {showModal && <div className="fixed inset-0 z-[100] bg-black/40 p-4 flex items-center justify-center" onMouseDown={e=>{if(e.target===e.currentTarget)setShowModal(false)}}><div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between"><div><h2 className="font-bold text-lg text-gray-900">{editing?'Edit Partner Brand':'Add Partner Brand'}</h2><p className="text-xs text-gray-500">Brand name and logo</p></div><button onClick={()=>setShowModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5"/></button></div>
      <div className="p-5 space-y-4">
        <div><label className="text-sm font-semibold text-gray-700">Brand name</label><input value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500" placeholder="e.g. Omera" /></div>
        <div><label className="text-sm font-semibold text-gray-700">Brand logo</label><div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)} onDrop={onDrop} onClick={()=>fileInputRef.current?.click()} className={`mt-1 min-h-36 border-2 border-dashed rounded-2xl flex items-center justify-center cursor-pointer transition ${dragOver?'border-blue-500 bg-blue-50':'border-gray-200 hover:border-blue-300'}`}>
          {uploading?<div className="text-center"><Loader2 className="w-7 h-7 animate-spin text-blue-600 mx-auto"/><p className="text-xs text-gray-500 mt-2">Uploading...</p></div>:form.logo_url?<img src={form.logo_url} alt="Preview" className="max-h-28 max-w-[80%] object-contain"/>:<div className="text-center"><Upload className="w-7 h-7 text-blue-500 mx-auto"/><p className="text-sm font-medium text-gray-700 mt-2">Click or drag logo here</p><p className="text-xs text-gray-400">JPG, PNG, WebP, SVG · max 4MB</p></div>}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)uploadLogo(f);e.target.value=''}}/>
        </div></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-semibold text-gray-700">Sort order</label><input type="number" min="0" value={form.sort_order} onChange={e=>setForm(v=>({...v,sort_order:Number(e.target.value)}))} className="mt-1 w-full px-3 py-2.5 border border-gray-200 rounded-xl"/></div><label className="flex items-center gap-2 pt-7 text-sm font-medium text-gray-700"><input type="checkbox" checked={form.is_active} onChange={e=>setForm(v=>({...v,is_active:e.target.checked}))} className="w-4 h-4"/> Active on homepage</label></div>
      </div>
      <div className="p-5 border-t border-gray-100 flex justify-end gap-2"><button onClick={()=>setShowModal(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold">Cancel</button><button disabled={saving||uploading} onClick={save} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">{saving?'Saving...':'Save Brand'}</button></div>
    </div></div>}
  </div>;
}
