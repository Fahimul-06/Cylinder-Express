import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Upload, Image, Loader2, X, Trash2, ToggleLeft, ToggleRight, Pencil, Check, ArrowUp, ArrowDown } from 'lucide-react';
import { HeroSlide } from '../../lib/types';

type HeroForm = {
  title: string;
  subtitle: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
};

const emptyForm: HeroForm = {
  title: '',
  subtitle: '',
  image_url: '',
  sort_order: 0,
  is_active: true,
};

export default function AdminHeroImages() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<HeroSlide | null>(null);
  const [form, setForm] = useState<HeroForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSlides();
  }, []);

  async function fetchSlides() {
    const { data } = await supabase.from('hero_slides').select('*').order('sort_order');
    setSlides(data || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, sort_order: slides.length + 1 });
    setShowModal(true);
  }

  function openEdit(slide: HeroSlide) {
    setEditing(slide);
    setForm({
      title: slide.title || '',
      subtitle: slide.subtitle || '',
      image_url: slide.image_url || '',
      sort_order: slide.sort_order || 0,
      is_active: slide.is_active !== false,
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
    if (file.size > 8 * 1024 * 1024) {
      alert('Hero image must be under 8MB.');
      return;
    }
    setUploadingImage(true);
    const ext = file.name.split('.').pop();
    const fileName = `hero/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await supabase.storage.from('product-images').upload(fileName, file, { upsert: false });
    if (error) {
      alert('Hero image upload failed: ' + error.message);
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
    if (!form.image_url) {
      alert('Please upload or paste a hero image.');
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title || null,
      subtitle: form.subtitle || null,
      image_url: form.image_url,
      sort_order: Number(form.sort_order || 0),
      is_active: form.is_active !== false,
    };

    if (editing) {
      await supabase.from('hero_slides').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('hero_slides').insert(payload);
    }
    await fetchSlides();
    setShowModal(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this hero image?')) return;
    setDeleting(id);
    await supabase.from('hero_slides').delete().eq('id', id);
    setSlides(prev => prev.filter(slide => slide.id !== id));
    setDeleting(null);
  }

  async function toggleActive(slide: HeroSlide) {
    const is_active = !slide.is_active;
    await supabase.from('hero_slides').update({ is_active }).eq('id', slide.id);
    setSlides(prev => prev.map(item => item.id === slide.id ? { ...item, is_active } : item));
  }

  async function moveSlide(slide: HeroSlide, direction: -1 | 1) {
    const currentIndex = slides.findIndex(item => item.id === slide.id);
    const target = slides[currentIndex + direction];
    if (!target) return;
    const currentOrder = slide.sort_order || currentIndex + 1;
    const targetOrder = target.sort_order || currentIndex + direction + 1;
    await Promise.all([
      supabase.from('hero_slides').update({ sort_order: targetOrder }).eq('id', slide.id),
      supabase.from('hero_slides').update({ sort_order: currentOrder }).eq('id', target.id),
    ]);
    await fetchSlides();
  }

  if (loading) {
    return <div className="p-6 animate-pulse space-y-4"><div className="h-8 w-56 bg-gray-200 rounded" /><div className="h-48 bg-gray-100 rounded-2xl" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Home Hero Images</h1>
          <p className="text-sm text-gray-500">Upload and manage homepage hero section photos.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all">
          <Plus className="w-4 h-4" /> Add Hero Image
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {slides.map((slide, index) => (
          <div key={slide.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="aspect-[16/7] bg-gray-100 overflow-hidden">
              <img src={slide.image_url} alt={slide.title || `Hero ${index + 1}`} className="w-full h-full object-cover" />
            </div>
            <div className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 truncate">{slide.title || `Hero image ${index + 1}`}</p>
                  {!slide.is_active && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold">INACTIVE</span>}
                </div>
                <p className="text-xs text-gray-500 truncate">Sort order: {slide.sort_order || index + 1}{slide.subtitle ? ` · ${slide.subtitle}` : ''}</p>
              </div>
              <button onClick={() => moveSlide(slide, -1)} disabled={index === 0} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
              <button onClick={() => moveSlide(slide, 1)} disabled={index === slides.length - 1} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
              <button onClick={() => toggleActive(slide)} className={`p-1.5 rounded-lg ${slide.is_active ? 'text-green-500 hover:bg-green-50' : 'text-gray-300 hover:bg-gray-50'}`}>
                {slide.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => openEdit(slide)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(slide.id)} disabled={deleting === slide.id} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {slides.length === 0 && (
          <div className="lg:col-span-2 text-center py-14 bg-white rounded-2xl border border-gray-100">
            <Image className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">No custom hero images yet</p>
            <p className="text-sm text-gray-400">The website will use the default hero images until you add one.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{editing ? 'Edit Hero Image' : 'Add Hero Image'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hero Photo *</label>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'}`}
                >
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" onChange={handleFileChange} className="hidden" />
                  {form.image_url ? (
                    <div className="p-3">
                      <div className="aspect-[16/7] rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                        <img src={form.image_url} alt="Hero preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Hero photo added</p>
                          <p className="text-xs text-gray-400">Click or drag to replace</p>
                        </div>
                        <button type="button" onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, image_url: '' })); }} className="p-1.5 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                      {uploadingImage ? <><Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" /><p className="text-sm text-blue-600 font-medium">Uploading photo...</p></> : <><div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3"><Upload className="w-6 h-6 text-blue-500" /></div><p className="text-sm font-medium text-gray-700">Click to choose hero photo</p><p className="text-xs text-gray-400 mt-1">or drag & drop here</p><p className="text-xs text-gray-300 mt-1">Best ratio: 16:7 or 16:8 · Max 8MB</p></>}
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1.5"><Image className="w-3.5 h-3.5 text-gray-400" /><span className="text-xs text-gray-400">Or paste image URL</span></div>
                  <input value={form.image_url || ''} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                <input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" />
                </div>
                <label className="flex items-end gap-2 text-sm cursor-pointer pb-3">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                  Active
                </label>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving || uploadingImage || !form.image_url} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"><Check className="w-4 h-4" /> {saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
