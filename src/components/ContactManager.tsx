import { useState, useEffect } from 'react';
import { supabase, ContactInfo } from '../lib/supabase';
import { Save, Loader2, AlertCircle, CheckCircle, Mail, Phone, MapPin, Github, Linkedin } from 'lucide-react';

export function ContactManager() {
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchContact();
  }, []);

  const fetchContact = async () => {
    const { data, error } = await supabase
      .from('contact_info')
      .select('*')
      .single();

    if (error) {
      setError('Failed to load contact info');
    } else {
      setContact(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact) return;

    setError('');
    setSuccess('');
    setSaving(true);

    const { error } = await supabase
      .from('contact_info')
      .update({
        email: contact.email,
        phone: contact.phone,
        location: contact.location,
        github_url: contact.github_url,
        linkedin_url: contact.linkedin_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contact.id);

    setSaving(false);

    if (error) {
      setError('Failed to save changes');
    } else {
      setSuccess('Changes saved successfully!');
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

  if (!contact) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
        No contact info found. Please run migrations.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <Mail className="text-amber-500" size={24} />
          <h2 className="text-lg font-semibold text-gray-100">Contact Information</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input
                type="email"
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="fahimul.arefin@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input
                type="text"
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input
              type="text"
              value={contact.location}
              onChange={(e) => setContact({ ...contact, location: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="Available Remote Worldwide"
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <Linkedin className="text-amber-500" size={24} />
          <h2 className="text-lg font-semibold text-gray-100">Social Links</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">GitHub URL</label>
          <div className="relative">
            <Github className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input
              type="url"
              value={contact.github_url}
              onChange={(e) => setContact({ ...contact, github_url: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="https://github.com/username"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">LinkedIn URL</label>
          <div className="relative">
            <Linkedin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input
              type="url"
              value={contact.linkedin_url}
              onChange={(e) => setContact({ ...contact, linkedin_url: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="https://linkedin.com/in/username"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-900 font-semibold rounded-lg hover:from-amber-400 hover:to-orange-500 transition-all disabled:opacity-70"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Saving...
            </>
          ) : (
            <>
              <Save size={20} />
              Save Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
}
