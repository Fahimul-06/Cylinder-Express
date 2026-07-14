import { useEffect, useState } from 'react';
import { supabase, Education } from '../lib/supabase';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  GraduationCap,
  MapPin,
} from 'lucide-react';

export function EducationManager() {
  const [education, setEducation] = useState<Education[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    degree: '',
    institution: '',
    period: '',
    location: '',
    result: '',
    description: '',
    display_order: 0,
  });

  useEffect(() => {
    fetchEducation();
  }, []);

  const fetchEducation = async () => {
    const { data, error } = await supabase
      .from('education')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      setError('Failed to load education records');
    } else {
      setEducation(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      degree: '',
      institution: '',
      period: '',
      location: '',
      result: '',
      description: '',
      display_order: education.length + 1,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (item: Education) => {
    setFormData({
      degree: item.degree,
      institution: item.institution,
      period: item.period,
      location: item.location || '',
      result: item.result || '',
      description: item.description || '',
      display_order: item.display_order,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const payload = {
      ...formData,
      display_order: Number(formData.display_order) || 0,
    };

    if (editingId) {
      const { error } = await supabase
        .from('education')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingId);

      if (error) {
        setError(error.message || 'Failed to update education record');
      } else {
        setSuccess('Education record updated successfully!');
        fetchEducation();
        resetForm();
      }
    } else {
      const { error } = await supabase.from('education').insert(payload);

      if (error) {
        setError(error.message || 'Failed to add education record');
      } else {
        setSuccess('Education record added successfully!');
        fetchEducation();
        resetForm();
      }
    }

    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this education record?')) return;

    const { error } = await supabase.from('education').delete().eq('id', id);

    if (error) {
      setError(error.message || 'Failed to delete education record');
    } else {
      setEducation(education.filter((item) => item.id !== id));
      setSuccess('Education record deleted successfully!');
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

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-gray-100 font-medium">{education.length} education records</h2>
          <p className="mt-1 text-sm text-gray-500">Add degrees, schools, colleges, certifications, or training history.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-900 font-medium rounded-lg hover:from-amber-400 hover:to-orange-500 transition-all"
        >
          <Plus size={18} />
          Add Education
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-100">
              {editingId ? 'Edit Education' : 'Add New Education'}
            </h3>
            <button onClick={resetForm} className="p-2 text-gray-400 hover:text-gray-100 transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Degree / Program</label>
                <input
                  type="text"
                  value={formData.degree}
                  onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="B.Sc. in Computer Science & Engineering"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Institution</label>
                <input
                  type="text"
                  value={formData.institution}
                  onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="University / College / Institute"
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Period</label>
                <input
                  type="text"
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="2018 - 2022"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="Dhaka, Bangladesh"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Display Order</label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Result / Grade</label>
              <input
                type="text"
                value={formData.result}
                onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="CGPA: 3.80/4.00, First Class, GPA: 5.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                placeholder="Major subjects, achievements, thesis, projects, or relevant coursework..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-900 font-medium rounded-lg hover:from-amber-400 hover:to-orange-500 transition-all"
              >
                <Save size={18} />
                {editingId ? 'Update' : 'Add'} Education
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 bg-slate-800 text-gray-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {education.map((item) => (
          <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-amber-500/30 transition-colors">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <GraduationCap size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-100">{item.degree}</h3>
                  <p className="mt-1 text-amber-400 font-medium">{item.institution}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-400">
                    <span>{item.period}</span>
                    {item.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={14} />
                        {item.location}
                      </span>
                    )}
                    {item.result && <span className="rounded-full bg-slate-800 px-3 py-1 text-gray-300">{item.result}</span>}
                  </div>
                  {item.description && <p className="mt-3 text-gray-400 leading-relaxed whitespace-pre-line">{item.description}</p>}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => handleEdit(item)} className="p-2 text-gray-400 hover:text-amber-400 transition-colors">
                  <Edit size={18} />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-400 hover:text-red-400 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {education.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center text-gray-500">
            No education records added yet.
          </div>
        )}
      </div>
    </div>
  );
}
