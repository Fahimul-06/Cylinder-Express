import { useState, useEffect } from 'react';
import { supabase, Experience } from '../lib/supabase';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Building2,
} from 'lucide-react';

export function ExperienceManager() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    period: '',
    description: '',
    display_order: 0,
  });

  useEffect(() => {
    fetchExperiences();
  }, []);

  const fetchExperiences = async () => {
    const { data, error } = await supabase
      .from('experience')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      setError('Failed to load experience');
    } else {
      setExperiences(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      company: '',
      period: '',
      description: '',
      display_order: experiences.length + 1,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (exp: Experience) => {
    setFormData({
      title: exp.title,
      company: exp.company,
      period: exp.period,
      description: exp.description,
      display_order: exp.display_order,
    });
    setEditingId(exp.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (editingId) {
      const { error } = await supabase
        .from('experience')
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);

      if (error) {
        setError('Failed to update experience');
      } else {
        setSuccess('Experience updated successfully!');
        fetchExperiences();
        resetForm();
      }
    } else {
      const { error } = await supabase.from('experience').insert(formData);

      if (error) {
        setError('Failed to add experience');
      } else {
        setSuccess('Experience added successfully!');
        fetchExperiences();
        resetForm();
      }
    }

    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this experience?')) return;

    const { error } = await supabase.from('experience').delete().eq('id', id);

    if (error) {
      setError('Failed to delete experience');
    } else {
      setExperiences(experiences.filter((e) => e.id !== id));
      setSuccess('Experience deleted successfully!');
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
        <h2 className="text-gray-100 font-medium">{experiences.length} positions</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-900 font-medium rounded-lg hover:from-amber-400 hover:to-orange-500 transition-all"
        >
          <Plus size={18} />
          Add Position
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-100">
              {editingId ? 'Edit Position' : 'Add New Position'}
            </h3>
            <button onClick={resetForm} className="p-2 text-gray-400 hover:text-gray-100 transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Job Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="Senior Full Stack Developer"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Company</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="TechCorp Solutions"
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Period</label>
                <input
                  type="text"
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="2022 - Present"
                  required
                />
              </div>

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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                placeholder="Describe your responsibilities and achievements..."
                required
              />
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
                {editingId ? 'Update' : 'Add'} Position
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {experiences.map((exp) => (
          <div
            key={exp.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <div className="p-3 bg-amber-500/10 rounded-xl flex-shrink-0">
                  <Building2 className="text-amber-400" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-100">{exp.title}</h3>
                  <p className="text-amber-400/80 text-sm">{exp.company}</p>
                  <p className="text-gray-500 text-sm mt-1">{exp.period}</p>
                  <p className="text-gray-400 text-sm mt-3 max-w-2xl">{exp.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleEdit(exp)}
                  className="p-2 text-gray-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => handleDelete(exp.id)}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {experiences.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No experience added yet. Click "Add Position" to get started.
          </div>
        )}
      </div>
    </div>
  );
}
