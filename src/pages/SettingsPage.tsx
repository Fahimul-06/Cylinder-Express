import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, BellRing, ChevronRight, CircleHelp, Languages, LogOut, MapPin,
  Megaphone, Navigation, ShieldCheck, Smartphone, Trash2, UserRound,
  Flame, LockKeyhole, FileText, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { CustomerSettings } from '../lib/types';

type ToggleRowProps = {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: typeof Bell;
};

const defaults: Required<CustomerSettings> = {
  language: 'en',
  browser_notifications: true,
  order_updates: true,
  cylinder_reminders: true,
  special_offer_popups: true,
  location_features: true,
};

function ToggleRow({ title, description, checked, onChange, icon: Icon }: ToggleRowProps) {
  return (
    <div className="flex items-start gap-4 px-4 py-4 sm:px-5">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-gray-900">{title}</div>
        <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function LinkRow({ title, description, path, icon: Icon, danger = false }: { title: string; description?: string; path: string; icon: typeof Bell; danger?: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(path)}
      className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-gray-50 sm:px-5"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-700'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-bold ${danger ? 'text-red-700' : 'text-gray-900'}`}>{title}</div>
        {description && <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
    </button>
  );
}

export default function SettingsPage() {
  const { profile, updateProfile, signOut } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const initialSettings = useMemo<Required<CustomerSettings>>(() => ({
    ...defaults,
    ...profile?.customer_settings,
    language: profile?.customer_settings?.language || language,
  }), [profile?.customer_settings, language]);

  const [settings, setSettings] = useState<Required<CustomerSettings>>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  function updateSetting<K extends keyof CustomerSettings>(key: K, value: Required<CustomerSettings>[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError('');
  }

  async function enableBrowserNotifications(next: boolean) {
    if (!next) {
      updateSetting('browser_notifications', false);
      return;
    }
    if (!('Notification' in window)) {
      setError('Browser notifications are not supported on this device. In-app notifications will still work.');
      updateSetting('browser_notifications', false);
      return;
    }
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission was not granted. You can still view notifications inside Cylinder Express.');
        updateSetting('browser_notifications', false);
        return;
      }
      updateSetting('browser_notifications', true);
    } catch {
      setError('Could not enable browser notifications on this device.');
      updateSetting('browser_notifications', false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setSaved(false);
    setError('');
    const { error: saveError } = await updateProfile({ customer_settings: settings });
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    setLanguage(settings.language);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  async function handleSignOut() {
    await signOut();
    navigate('/home');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
            <Smartphone className="h-4 w-4" /> Customer preferences
          </div>
          <h1 className="mt-2 text-2xl font-black text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Control how Cylinder Express behaves for your account and device.</p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {saved && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Settings saved.
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
            <h2 className="font-black text-gray-900">Language</h2>
            <p className="mt-1 text-xs text-gray-500">Choose the language used across Cylinder Express.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 sm:p-5">
            <button
              type="button"
              onClick={() => updateSetting('language', 'en')}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${settings.language === 'en' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700'}`}
            >
              <Languages className="h-4 w-4" /> English
            </button>
            <button
              type="button"
              onClick={() => updateSetting('language', 'bn')}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${settings.language === 'bn' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700'}`}
            >
              <Languages className="h-4 w-4" /> বাংলা
            </button>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
            <h2 className="font-black text-gray-900">Notifications & Offers</h2>
            <p className="mt-1 text-xs text-gray-500">In-app notification history remains available even when browser alerts are off.</p>
          </div>
          <div className="divide-y divide-gray-100">
            <ToggleRow
              title="Browser alerts"
              description="Show supported device/browser alerts for new customer notifications."
              checked={settings.browser_notifications}
              onChange={enableBrowserNotifications}
              icon={BellRing}
            />
            <ToggleRow
              title="Order & delivery updates"
              description="Allow browser alerts for order confirmation, delivery and order status changes."
              checked={settings.order_updates}
              onChange={(value) => updateSetting('order_updates', value)}
              icon={Bell}
            />
            <ToggleRow
              title="Cylinder refill reminders"
              description="Allow reminder alerts when your LPG cylinder is predicted to be nearly empty."
              checked={settings.cylinder_reminders}
              onChange={(value) => updateSetting('cylinder_reminders', value)}
              icon={Flame}
            />
            <ToggleRow
              title="Special Offer popup"
              description="Show the active Special Offer image when you open the Home page."
              checked={settings.special_offer_popups}
              onChange={(value) => updateSetting('special_offer_popups', value)}
              icon={Megaphone}
            />
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
            <h2 className="font-black text-gray-900">Location & Privacy</h2>
            <p className="mt-1 text-xs text-gray-500">You can always enter addresses manually.</p>
          </div>
          <ToggleRow
            title="Location features"
            description="Allow Cylinder Express customer pages to request GPS for address detection and live delivery assistance."
            checked={settings.location_features}
            onChange={(value) => updateSetting('location_features', value)}
            icon={Navigation}
          />
          <div className="border-t border-gray-100">
            <LinkRow title="Delivery addresses" description="Manage saved home, office and other addresses." path="/addresses" icon={MapPin} />
            <LinkRow title="Privacy Policy" description="See what customer and delivery data Cylinder Express uses." path="/privacy-policy" icon={ShieldCheck} />
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
            <h2 className="font-black text-gray-900">Account & Security</h2>
          </div>
          <div className="divide-y divide-gray-100">
            <LinkRow title="My Profile" description="Edit your name, phone, email and cooking profile." path="/profile/details" icon={UserRound} />
            <LinkRow title="Change password" description="Update the password used for your Cylinder Express account." path="/profile/details" icon={LockKeyhole} />
            <LinkRow title="Delete My Account" description="Permanently delete your customer account and associated data." path="/account-deletion" icon={Trash2} danger />
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
            <h2 className="font-black text-gray-900">Help & Legal</h2>
          </div>
          <div className="divide-y divide-gray-100">
            <LinkRow title="Help & FAQ" path="/faq" icon={CircleHelp} />
            <LinkRow title="Contact Customer Care" path="/contact-us" icon={Bell} />
            <LinkRow title="Terms of Use" path="/terms-of-use" icon={FileText} />
          </div>
        </section>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3.5 text-sm font-bold text-gray-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
