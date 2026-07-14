import { useState, useEffect } from 'react';
import { supabase, Project, uploadFile } from '../lib/supabase';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  ExternalLink as ExternalLinkIcon,
  Images,
  Link as LinkIcon,
  Eye,
  EyeOff,
} from 'lucide-react';
import { FileUpload } from './FileUpload';

const categories = ['fullstack', 'frontend', 'backend', 'mobile'] as const;
type Category = typeof categories[number];

export function ProjectsManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    detailed_description: '',
    tech: '',
    image_url: '',
    gallery_urls: [] as string[],
    live_url: '',
    github_url: '',
    github_url_public: true,
    category: 'fullstack' as Category,
    display_order: 0,
    is_featured: true,
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      setError('Failed to load projects');
    } else {
      setProjects(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      detailed_description: '',
      tech: '',
      image_url: '',
      gallery_urls: [],
      live_url: '',
      github_url: '',
      github_url_public: true,
      category: 'fullstack',
      display_order: projects.length + 1,
      is_featured: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (project: Project) => {
    setFormData({
      title: project.title,
      description: project.description,
      detailed_description: project.detailed_description || '',
      tech: Array.isArray(project.tech) ? project.tech.join(', ') : '',
      image_url: project.image_url,
      gallery_urls: Array.isArray(project.gallery_urls) ? project.gallery_urls : [],
      live_url: project.live_url,
      github_url: project.github_url,
      github_url_public: project.github_url_public !== false,
      category: project.category,
      display_order: project.display_order,
      is_featured: project.is_featured,
    });
    setEditingId(project.id);
    setShowForm(true);
  };

  const handleGalleryUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingGallery(true);
    setError('');

    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          setError('Only image files are allowed in the project gallery.');
          continue;
        }
        const url = await uploadFile(file, 'projects/gallery');
        if (url) uploaded.push(url);
      }

      if (uploaded.length > 0) {
        setFormData((current) => ({
          ...current,
          gallery_urls: [...current.gallery_urls, ...uploaded],
        }));
        setSuccess(`${uploaded.length} gallery image${uploaded.length > 1 ? 's' : ''} uploaded.`);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError('Failed to upload gallery images.');
    } finally {
      setUploadingGallery(false);
    }
  };

  const addGalleryUrl = (url: string) => {
    const clean = url.trim();
    if (!clean) return;
    setFormData((current) => ({
      ...current,
      gallery_urls: [...current.gallery_urls, clean],
    }));
  };

  const removeGalleryUrl = (index: number) => {
    setFormData((current) => ({
      ...current,
      gallery_urls: current.gallery_urls.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const techArray = formData.tech
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t);

    const payload = {
      title: formData.title,
      description: formData.description,
      detailed_description: formData.detailed_description,
      tech: techArray,
      image_url: formData.image_url,
      gallery_urls: formData.gallery_urls.filter(Boolean),
      live_url: formData.live_url,
      github_url: formData.github_url,
      github_url_public: formData.github_url_public,
      category: formData.category,
      display_order: formData.display_order,
      is_featured: formData.is_featured,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase.from('projects').update(payload).eq('id', editingId);

      if (error) {
        setError('Failed to update project');
      } else {
        setSuccess('Project updated successfully!');
        fetchProjects();
        resetForm();
      }
    } else {
      const { error } = await supabase.from('projects').insert(payload);

      if (error) {
        setError('Failed to add project');
      } else {
        setSuccess('Project added successfully!');
        fetchProjects();
        resetForm();
      }
    }

    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    const { error } = await supabase.from('projects').delete().eq('id', id);

    if (error) {
      setError('Failed to delete project');
    } else {
      setProjects(projects.filter((p) => p.id !== id));
      setSuccess('Project deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3 text-green-400">
          <CheckCircle size={20} />
          <span>{success}</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-gray-100 font-medium">{projects.length} projects</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-900 font-medium rounded-lg hover:from-amber-400 hover:to-orange-500 transition-all"
        >
          <Plus size={18} />
          Add Project
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-100">
              {editingId ? 'Edit Project' : 'Add New Project'}
            </h3>
            <button onClick={resetForm} className="p-2 text-gray-400 hover:text-gray-100 transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="Project name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as Category })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Short Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                placeholder="Short summary shown on the project card..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Full Project Details</label>
              <textarea
                value={formData.detailed_description}
                onChange={(e) => setFormData({ ...formData, detailed_description: e.target.value })}
                rows={7}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="Write full project details paragraph-wise. Use blank lines between paragraphs."
              />
              <p className="mt-2 text-xs text-gray-500">This text appears on the dedicated project details page.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Technologies (comma-separated)
              </label>
              <input
                type="text"
                value={formData.tech}
                onChange={(e) => setFormData({ ...formData, tech: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="React, Node.js, MongoDB"
                required
              />
            </div>

            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <ImageIcon size={16} />
                <span>Main Project Image</span>
              </div>
              <FileUpload
                value={formData.image_url}
                onChange={(url) => setFormData({ ...formData, image_url: url })}
                accept="image"
                folder="projects"
              />
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Or use external Image URL</label>
                <div className="flex items-center gap-2">
                  <ExternalLinkIcon size={16} className="text-gray-500" />
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Images size={16} />
                <span>Project Gallery Photos</span>
              </div>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleGalleryUpload(e.target.files)}
                className="block w-full text-sm text-gray-400 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:font-medium file:text-slate-950 hover:file:bg-amber-400"
              />
              {uploadingGallery && (
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <Loader2 size={16} className="animate-spin" /> Uploading gallery photos...
                </div>
              )}
              <GalleryUrlInput onAdd={addGalleryUrl} />
              {formData.gallery_urls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {formData.gallery_urls.map((url, index) => (
                    <div key={`${url}-${index}`} className="relative group rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                      <img src={url} alt={`Gallery ${index + 1}`} className="h-28 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeGalleryUrl(index)}
                        className="absolute top-2 right-2 rounded-full bg-red-500/90 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove gallery photo"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500">These photos appear on the project details page.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Live Demo URL</label>
                <input
                  type="url"
                  value={formData.live_url}
                  onChange={(e) => setFormData({ ...formData, live_url: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">GitHub URL / Source Code URL</label>
                <input
                  type="url"
                  value={formData.github_url}
                  onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="https://github.com/..."
                />
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700/70 bg-slate-800/50 p-3 text-sm text-gray-300 hover:border-amber-500/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={formData.github_url_public}
                    onChange={(e) => setFormData({ ...formData, github_url_public: e.target.checked })}
                    className="mt-0.5 h-5 w-5 accent-amber-500"
                  />
                  <span>
                    <span className="block font-medium text-gray-100">Show GitHub URL publicly</span>
                    <span className="block text-xs text-gray-500">
                      Turn this off to keep the source-code URL saved in admin but hidden from visitors.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Display Order</label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-3 pt-8">
                <input
                  type="checkbox"
                  id="featured"
                  checked={formData.is_featured}
                  onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                  className="w-5 h-5 accent-amber-500"
                />
                <label htmlFor="featured" className="text-gray-300">
                  Featured Project
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-slate-700 text-gray-300 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-900 font-medium rounded-lg hover:from-amber-400 hover:to-orange-500 transition-all"
              >
                <Save size={18} />
                {editingId ? 'Update' : 'Add'} Project
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors"
          >
            <div className="flex gap-4">
              {project.image_url && (
                <img
                  src={project.image_url}
                  alt={project.title}
                  className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-100">{project.title}</h3>
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">{project.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => window.open(`/projects/${project.id}`, '_blank')}
                      className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Open project page"
                    >
                      <LinkIcon size={18} />
                    </button>
                    <button
                      onClick={() => handleEdit(project)}
                      className="p-2 text-gray-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="px-2 py-1 bg-amber-500/10 text-amber-400 text-xs rounded">
                    {project.category}
                  </span>
                  {project.tech.slice(0, 4).map((tech) => (
                    <span key={tech} className="px-2 py-1 bg-slate-800 text-gray-400 text-xs rounded">
                      {tech}
                    </span>
                  ))}
                  {project.gallery_urls?.length ? (
                    <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 text-xs rounded">
                      {project.gallery_urls.length} gallery photo{project.gallery_urls.length > 1 ? 's' : ''}
                    </span>
                  ) : null}
                  {project.github_url ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${project.github_url_public !== false ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {project.github_url_public !== false ? <Eye size={12} /> : <EyeOff size={12} />}
                      GitHub {project.github_url_public !== false ? 'Public' : 'Private'}
                    </span>
                  ) : null}
                  {project.is_featured && (
                    <span className="px-2 py-1 bg-orange-500/10 text-orange-400 text-xs rounded">
                      Featured
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No projects added yet. Click "Add Project" to get started.
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryUrlInput({ onAdd }: { onAdd: (url: string) => void }) {
  const [url, setUrl] = useState('');
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">Or add gallery photo URL</label>
      <div className="flex items-center gap-2">
        <ExternalLinkIcon size={16} className="text-gray-500" />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors text-sm"
          placeholder="https://..."
        />
        <button
          type="button"
          onClick={() => {
            onAdd(url);
            setUrl('');
          }}
          className="px-4 py-3 rounded-lg border border-slate-700 text-gray-300 hover:border-amber-500 hover:text-amber-400 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}
