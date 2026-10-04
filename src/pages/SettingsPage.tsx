import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, BellRing, ChevronRight, HelpCircle, Languages, LocateFixed,
  LockKeyhole, LogOut, MapPin, MessageCircleQuestion, ShieldCheck, Smartphone,
  Sparkles, Trash2, UserRound, Volume2, Vibrate, FileText, Info, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  CustomerSettings,
  getCustomerSettings,
  saveCustomerSettings,
} from '../lib/customerSettings';

type PermissionState = 'granted' | 'denied' | 'prompt' | 'default' | 'unsupported' | 'unknown';

function Toggle({ checked, onChange, disabled = false, label }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
        checked ? 'bg-blue-600' : 'bg-gray-300'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function Row({ icon: Icon, title, description, onClick, right }: {
  icon: typeof Bell;
  title: string;
  description?: string;
  onClick?: () => void;
  right?: ReactNode;
}) {
  const content = (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="font-semibold text-gray-900">{title}</p>
        {description && <p className="mt-0.5 text-xs leading-5 text-gray-500">{description}</p>}
      </div>
      {right ?? (onClick ? <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" /> : null)}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
        {content}
      </button>
    );
  }

  return <div className="flex w-full items-center gap-3 px-4 py-3.5">{content}</div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.14em] text-gray-400">{title}</h2>
      <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {children}
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [settings, setSettings] = useState<CustomerSettings>(() => getCustomerSettings(user?.id));
  const [notificationPermission, setNotificationPermission] = useState<PermissionState>('unknown');
  const [locationPermission, setLocationPermission] = useState<PermissionState>('unknown');
  const [statusMessage, setStatusMessage] = useState('');

  const customerName = profile?.full_name || 'Customer';

  useEffect(() => {
    setSettings(getCustomerSettings(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
    } else {
      setNotificationPermission(Notification.permission as PermissionState);
    }

    if (!navigator.permissions?.query) {
      setLocationPermission('unknown');
      return;
    }

    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      setLocationPermission(result.state as PermissionState);
      result.onchange = () => setLocationPermission(result.state as PermissionState);
    }).catch(() => setLocationPermission('unknown'));
  }, []);

  const permissionLabel = useMemo(() => {
    if (notificationPermission === 'granted') return 'Allowed';
    if (notificationPermission === 'denied') return 'Blocked in device/browser settings';
    if (notificationPermission === 'unsupported') return 'Not supported on this device';
    return 'Not enabled';
  }, [notificationPermission]);

  const locationLabel = useMemo(() => {
    if (locationPermission === 'granted') return 'Allowed';
    if (locationPermission === 'denied') return 'Blocked in device/browser settings';
    if (locationPermission === 'unsupported') return 'Not supported';
    return 'Ask when needed';
  }, [locationPermission]);

  function updateSetting<K extends keyof CustomerSettings>(key: K, value: CustomerSettings[K]) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveCustomerSettings(user?.id, next);
    setStatusMessage('Settings saved');
    window.setTimeout(() => setStatusMessage(''), 1800);
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result as PermissionState);
      if (result === 'granted') {
        updateSetting('backgroundAlerts', true);
      }
    } catch {
      setNotificationPermission('unsupported');
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationPermission('unsupported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationPermission('granted');
        setStatusMessage('Location permission is ready for delivery addresses');
        window.setTimeout(() => setStatusMessage(''), 2200);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setLocationPermission('denied');
        else setStatusMessage('Could not get your location. Please try again.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function handleSignOut() {
    await signOut();
    navigate('/home', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-600">{customerName}</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Settings</h1>
            <p className="mt-1 text-sm text-gray-500">Manage your app preferences, privacy, security and support.</p>
          </div>
          {statusMessage && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
              <CheckCircle2 className="h-4 w-4" /> {statusMessage}
            </div>
          )}
        </div>

        <Section title="Account">
          <Row icon={UserRound} title="Personal information" description="Name, phone, email, profile photo and household details" onClick={() => navigate('/profile/details')} />
          <Row icon={MapPin} title="Delivery addresses" description="Add or manage saved delivery locations" onClick={() => navigate('/addresses')} />
          <Row icon={LockKeyhole} title="Password & security" description="Change your password using phone OTP verification" onClick={() => navigate('/profile/details')} />
        </Section>

        <Section title="Language & experience">
          <Row
            icon={Languages}
            title="Language"
            description="Choose the language used across Cylinder Express"
            right={(
              <div className="flex rounded-xl bg-gray-100 p-1">
                <button type="button" onClick={() => setLanguage('en')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${language === 'en' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>EN</button>
                <button type="button" onClick={() => setLanguage('bn')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${language === 'bn' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>বাংলা</button>
              </div>
            )}
          />
          <Row
            icon={Sparkles}
            title="Special offer pop-ups"
            description="Show the current promotional banner when you open the Home page"
            right={<Toggle label="Special offer pop-ups" checked={settings.offerPopups} onChange={(value) => updateSetting('offerPopups', value)} />}
          />
        </Section>

        <Section title="Notifications">
          <Row
            icon={BellRing}
            title="Background alerts"
            description="Receive urgent order, delivery and cylinder reminders while Cylinder Express is open"
            right={<Toggle label="Background alerts" checked={settings.backgroundAlerts} onChange={(value) => updateSetting('backgroundAlerts', value)} />}
          />
          <Row
            icon={Volume2}
            title="Alert sound"
            description="Play a sound for urgent alerts"
            right={<Toggle label="Alert sound" checked={settings.notificationSound} disabled={!settings.backgroundAlerts} onChange={(value) => updateSetting('notificationSound', value)} />}
          />
          <Row
            icon={Vibrate}
            title="Vibration"
            description="Vibrate the device when supported"
            right={<Toggle label="Vibration" checked={settings.vibration} disabled={!settings.backgroundAlerts} onChange={(value) => updateSetting('vibration', value)} />}
          />
          <Row icon={Bell} title="Notification permission" description={permissionLabel} onClick={notificationPermission === 'granted' || notificationPermission === 'denied' ? undefined : enableNotifications} right={notificationPermission === 'granted' ? <span className="text-xs font-bold text-green-600">Enabled</span> : notificationPermission === 'denied' ? <span className="text-xs font-semibold text-red-600">Blocked</span> : <button type="button" onClick={enableNotifications} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">Enable</button>} />
          <Row icon={Smartphone} title="Notification inbox" description="Review all order, delivery and cylinder alerts" onClick={() => navigate('/notifications')} />
        </Section>

        <Section title="Location & privacy">
          <Row
            icon={LocateFixed}
            title="Location permission"
            description={`${locationLabel}. Used only when you choose device location for delivery.`}
            right={locationPermission === 'granted' ? <span className="text-xs font-bold text-green-600">Ready</span> : locationPermission === 'denied' ? <span className="text-xs font-semibold text-red-600">Blocked</span> : <button type="button" onClick={requestLocation} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">Allow</button>}
          />
          <Row icon={ShieldCheck} title="Privacy policy" description="How Cylinder Express uses account, order and location data" onClick={() => navigate('/privacy-policy')} />
          <Row icon={Trash2} title="Delete my account" description="Permanently request deletion of your customer account and active data" onClick={() => navigate('/account-deletion')} />
        </Section>

        <Section title="Help & legal">
          <Row icon={HelpCircle} title="Help & FAQ" description="Common questions about orders, delivery and services" onClick={() => navigate('/faq')} />
          <Row icon={MessageCircleQuestion} title="Contact Customer Care" description="Call or contact Cylinder Express support" onClick={() => navigate('/contact-us')} />
          <Row icon={FileText} title="Terms of use" onClick={() => navigate('/terms-of-use')} />
          <Row icon={Info} title="About Cylinder Express" onClick={() => navigate('/about')} />
        </Section>

        <button
          type="button"
          onClick={handleSignOut}
          className="mb-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3.5 font-bold text-red-600 shadow-sm hover:bg-red-50"
        >
          <LogOut className="h-5 w-5" /> Sign out
        </button>
      </div>
    </div>
  );
}
