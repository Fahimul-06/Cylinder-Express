import { useState, useEffect } from 'react';
import { supabase, AboutInfo } from '../lib/supabase';
import { Save, Loader2, AlertCircle, CheckCircle, User, Award, Link as LinkIcon, Image, Home, Palette } from 'lucide-react';
import { FileUpload } from './FileUpload';

export function AboutManager() {
  const [about, setAbout] = useState<AboutInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchAbout();
  }, []);

  const fetchAbout = async () => {
    const { data, error } = await supabase
      .from('about_info')
      .select('*')
      .single();

    if (error) {
      setError('Failed to load about info');
    } else {
      setAbout(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!about) return;

    setError('');
    setSuccess('');
    setSaving(true);

    const { error } = await supabase
      .from('about_info')
      .update({
        name: about.name,
        title: about.title,
        bio: about.bio,
        tagline: about.tagline,
        years_experience: about.years_experience,
        projects_completed: about.projects_completed,
        profile_image_url: about.profile_image_url,
        logo_url: about.logo_url,
        hero_background_url: about.hero_background_url,
        hero_status_text: about.hero_status_text,
        hero_cta_primary_text: about.hero_cta_primary_text,
        hero_cta_secondary_text: about.hero_cta_secondary_text,
        hero_greeting: about.hero_greeting,
        updated_at: new Date().toISOString(),
      })
      .eq('id', about.id);

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

  if (!about) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
        No about info found. Please run migrations.
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
          <User className="text-amber-500" size={24} />
          <h2 className="text-lg font-semibold text-gray-100">Personal Information</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
            <input
              type="text"
              value={about.name}
              onChange={(e) => setAbout({ ...about, name: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Job Title</label>
            <input
              type="text"
              value={about.title}
              onChange={(e) => setAbout({ ...about, title: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Tagline</label>
          <input
            type="text"
            value={about.tagline}
            onChange={(e) => setAbout({ ...about, tagline: e.target.value })}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
            placeholder="Passionate about building digital experiences"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
          <textarea
            value={about.bio}
            onChange={(e) => setAbout({ ...about, bio: e.target.value })}
            rows={8}
            placeholder={"Write your bio paragraph-wise. Use a blank line between paragraphs."}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors resize-y"
          />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <Award className="text-amber-500" size={24} />
          <h2 className="text-lg font-semibold text-gray-100">Statistics</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Years of Experience</label>
            <input
              type="number"
              value={about.years_experience}
              onChange={(e) => setAbout({ ...about, years_experience: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Projects Completed</label>
            <input
              type="number"
              value={about.projects_completed}
              onChange={(e) => setAbout({ ...about, projects_completed: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <Image className="text-amber-500" size={24} />
          <h2 className="text-lg font-semibold text-gray-100">Media Uploads</h2>
        </div>

        <div>
          <FileUpload
            value={about.profile_image_url}
            onChange={(url) => setAbout({ ...about, profile_image_url: url })}
            accept="image"
            label="Profile Image / GIF"
            folder="profile"
          />
          <p className="text-xs text-gray-500 mt-2">
            Supports JPG, PNG, WebP, and animated GIF. Recommended: square image or GIF for best fit.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <Palette className="text-amber-500" size={24} />
          <h2 className="text-lg font-semibold text-gray-100">Branding</h2>
        </div>

        <div>
          <FileUpload
            value={about.logo_url || ''}
            onChange={(url) => setAbout({ ...about, logo_url: url })}
            accept="image"
            label="Website Logo"
            folder="logo"
          />
          <p className="text-xs text-gray-500 mt-2">
            Upload your logo for the navbar. Recommended: square image, PNG with transparent background.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Or use external Logo URL</label>
          <input
            type="url"
            value={about.logo_url || ''}
            onChange={(e) => setAbout({ ...about, logo_url: e.target.value })}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <LinkIcon className="text-amber-500" size={24} />
          <h2 className="text-lg font-semibold text-gray-100">External Profile Link (Optional)</h2>
        </div>

        <p className="text-sm text-gray-500">
          Paste an externally hosted profile image/GIF URL if you prefer not to upload one. Resume uploads were removed; visitors now download the live portfolio as a PDF from the public Resume button.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Profile Image URL</label>
          <input
            type="url"
            value={about.profile_image_url}
            onChange={(e) => setAbout({ ...about, profile_image_url: e.target.value })}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <Home className="text-amber-500" size={24} />
          <h2 className="text-lg font-semibold text-gray-100">Hero Section (Homepage)</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Hero Background Image</label>
          <FileUpload
            value={about.hero_background_url || ''}
            onChange={(url) => setAbout({ ...about, hero_background_url: url })}
            accept="image"
            label="Background Image"
            folder="hero"
          />
          <p className="text-xs text-gray-500 mt-2">
            Upload a background image for the hero section. Recommended: high-resolution image (1920x1080 or larger).
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Or use external Background URL</label>
          <input
            type="url"
            value={about.hero_background_url || ''}
            onChange={(e) => setAbout({ ...about, hero_background_url: e.target.value })}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
            placeholder="https://..."
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Greeting Text</label>
            <input
              type="text"
              value={about.hero_greeting || ''}
              onChange={(e) => setAbout({ ...about, hero_greeting: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="Hi, I'm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status Text</label>
            <input
              type="text"
              value={about.hero_status_text || ''}
              onChange={(e) => setAbout({ ...about, hero_status_text: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="Available for new opportunities"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Primary CTA Button Text</label>
            <input
              type="text"
              value={about.hero_cta_primary_text || ''}
              onChange={(e) => setAbout({ ...about, hero_cta_primary_text: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="View My Work"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Secondary CTA Button Text</label>
            <input
              type="text"
              value={about.hero_cta_secondary_text || ''}
              onChange={(e) => setAbout({ ...about, hero_cta_secondary_text: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 focus:outline-none focus:border-amber-500 transition-colors"
              placeholder="Get In Touch"
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
