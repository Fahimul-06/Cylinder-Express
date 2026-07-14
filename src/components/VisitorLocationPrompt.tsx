import { useEffect, useState } from 'react';
import { Cookie, MapPin, X, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { requestAndTrackGpsLocation, trackVisitor, trackWithCachedGpsIfAvailable } from '../lib/visitorTracker';
import { getCookieConsentStatus, saveCookieConsentStatus } from '../lib/cookieConsent';

interface VisitorLocationPromptProps {
  directCallMode?: boolean;
}

export function VisitorLocationPrompt({ directCallMode = false }: VisitorLocationPromptProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const runTracking = async () => {
      const consent = getCookieConsentStatus();

      if (consent === 'accepted_all_location') {
        // First try cached approved GPS. Then ask the browser again only if permission is already granted.
        const usedCached = await trackWithCachedGpsIfAvailable();

        try {
          if ('permissions' in navigator && navigator.permissions?.query) {
            const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
            if (status.state === 'granted') {
              await requestAndTrackGpsLocation();
            }
          }
        } catch {
          // Some mobile browsers do not support Permissions API; cached/IP tracking is still recorded.
        }

        if (!usedCached) await trackVisitor();
        return;
      }

      await trackVisitor();

      if (consent === 'essential_only') return;

      const delay = directCallMode ? 700 : 1400;
      window.setTimeout(() => {
        if (active) setVisible(true);
      }, delay);
    };

    runTracking();
    return () => {
      active = false;
    };
  }, [directCallMode]);

  const acceptAllAndShareLocation = async () => {
    setLoading(true);
    setError('');
    try {
      saveCookieConsentStatus('accepted_all_location');
      await requestAndTrackGpsLocation();
      setDone(true);
      window.setTimeout(() => setVisible(false), 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Location permission was not allowed.';
      setError(`${message} Cookies were accepted, but exact GPS needs browser location permission.`);
      saveCookieConsentStatus('accepted_all_location');
    } finally {
      setLoading(false);
    }
  };

  const acceptEssentialOnly = () => {
    saveCookieConsentStatus('essential_only');
    setVisible(false);
  };

  const closeWithoutChoice = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 left-4 right-4 z-[70] mx-auto max-w-lg rounded-2xl border border-cyan-400/30 bg-slate-950/95 p-4 text-gray-100 shadow-2xl shadow-cyan-950/40 backdrop-blur-md sm:left-auto sm:right-5">
      <button
        onClick={closeWithoutChoice}
        className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-slate-800 hover:text-gray-100"
        aria-label="Close cookie location prompt"
      >
        <X size={18} />
      </button>

      <div className="flex gap-3 pr-7">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-300">
          <Cookie size={22} />
        </div>
        <div>
          <h3 className="font-bold text-white">Accept cookies & share location?</h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-300">
            Accept all cookies to remember your choice and share exact GPS location with the admin. Your browser will ask location permission once; after it is allowed, future visits usually do not need a second prompt.
          </p>

          <div className="mt-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-gray-300">
            <div className="flex gap-2">
              <ShieldCheck className="mt-0.5 shrink-0 text-cyan-300" size={15} />
              <p>
                Cookies cannot bypass phone/browser permission. If the visitor blocks location, admin will see approximate IP/device data only.
              </p>
            </div>
          </div>

          {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={acceptAllAndShareLocation}
              disabled={loading || done}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : done ? <CheckCircle2 size={16} /> : <MapPin size={16} />}
              {done ? 'Accepted & location shared' : loading ? 'Requesting GPS...' : 'Accept All & Share Location'}
            </button>
            <button
              onClick={acceptEssentialOnly}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-gray-300 transition hover:bg-slate-800"
            >
              Essential cookies only
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
