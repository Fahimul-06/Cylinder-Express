import { useState, useEffect } from 'react';
import { supabase, Certificate } from '../lib/supabase';
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
} from 'lucide-react';
import { FileUpload } from './FileUpload';

export function CertificatesManager() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    issuer: '',
    issue_date: '',
    credential_id: '',
    credential_url: '',
    image_url: '',
    description: '',
    display_order: 0,
  });

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      setError('Failed to load certificates');
    } else {
      setCertificates(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      issuer: '',
      issue_date: '',
      credential_id: '',
      credential_url: '',
      image_url: '',
      description: '',
      display_order: certificates.length + 1,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (certificate: Certificate) => {
    setFormData({
      title: certificate.title,
      issuer: certificate.issuer,
      issue_date: certificate.issue_date,
      credential_id: certificate.credential_id,
      credential_url: certificate.credential_url,
      image_url: certificate.image_url,
      description: certificate.description,
      display_order: certificate.display_order,
    });
    setEditingId(certificate.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (editingId) {
      const { error } = await supabase
        .from('certificates')
        .update({
          title: formData.title,
          issuer: formData.issuer,
          issue_date: formData.issue_date,
          credential_id: formData.credential_id,
          credential_url: formData.credential_url,
          image_url: formData.image_url,
          description: formData.description,
          display_order: formData.display_order,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);

      if (error) {
        setError('Failed to update certificate');
      } else {
        setSuccess('Certificate updated successfully!');
        fetchCertificates();
        resetForm();
      }
    } else {
      const { error } = await supabase.from('certificates').insert({
        title: formData.title,
        issuer: formData.issuer,
        issue_date: formData.issue_date,
        credential_id: formData.credential_id,
        credential_url: formData.credential_url,
        image_url: formData.image_url,
        description: formData.description,
        display_order: formData.display_order,
      });

      if (error) {
        setError('Failed to add certificate');
      } else {
        setSuccess('Certificate added successfully!');
        fetchCertificates();
        resetForm();
      }
    }

    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this certificate?')) return;

    const { error } = await supabase.from('certificates').delete().eq('id', id);

    if (error) {
      setError('Failed to delete certificate');
    } else {
      setCertificates(certificates.filter((c) => c.id !== id));
      setSuccess('Certificate deleted successfully!');
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
        <h2 className="text-gray-100 font-medium">{certificates.length} certificates</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-900 font-medium rounded-lg hover:from-amber-400 hover:to-orange-500 transition-all"
        >
          <Plus size={18} />
          Add Certificate
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-100">
              {editingId ? 'Edit Certificate' : 'Add New Certificate'}
            </h3>
            <button onClick={resetForm} className="p-2 text-gray-400 hover:text-gray-100 transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Certificate Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="e.g., AWS Certified Solutions Architect"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Issuing Organization</label>
                <input
                  type="text"
                  value={formData.issuer}
                  onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="e.g., Amazon Web Services"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                placeholder="Brief description of the certification..."
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Issue Date</label>
                <input
                  type="text"
                  value={formData.issue_date}
                  onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="e.g., March 2023"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Credential ID</label>
                <input
                  type="text"
                  value={formData.credential_id}
                  onChange={(e) => setFormData({ ...formData, credential_id: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="e.g., AWS-SAA-C03"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Credential URL</label>
              <input
                type="url"
                value={formData.credential_url}
                onChange={(e) => setFormData({ ...formData, credential_url: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="https://..."
              />
            </div>

            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <ImageIcon size={16} />
                <span>Certificate Image</span>
              </div>
              <FileUpload
                value={formData.image_url}
                onChange={(url) => setFormData({ ...formData, image_url: url })}
                accept="image"
                folder="certificates"
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
                {editingId ? 'Update' : 'Add'} Certificate
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {certificates.map((certificate) => (
          <div
            key={certificate.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors"
          >
            <div className="flex gap-4">
              {certificate.image_url && (
                <img
                  src={certificate.image_url}
                  alt={certificate.title}
                  className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-100">{certificate.title}</h3>
                    <p className="text-amber-400 text-sm mt-1">{certificate.issuer}</p>
                    <p className="text-gray-400 text-sm mt-1">{certificate.issue_date}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(certificate)}
                      className="p-2 text-gray-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(certificate.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                {certificate.description && (
                  <p className="text-gray-500 text-sm mt-2 line-clamp-2">{certificate.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {certificate.credential_id && (
                    <span className="px-2 py-1 bg-slate-800 text-gray-400 text-xs rounded">
                      ID: {certificate.credential_id}
                    </span>
                  )}
                  {certificate.credential_url && (
                    <a
                      href={certificate.credential_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 bg-cyan-500/10 text-cyan-400 text-xs rounded hover:bg-cyan-500/20 transition-colors flex items-center gap-1"
                    >
                      <ExternalLinkIcon size={12} />
                      View Credential
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {certificates.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No certificates added yet. Click "Add Certificate" to get started.
          </div>
        )}
      </div>
    </div>
  );
}
