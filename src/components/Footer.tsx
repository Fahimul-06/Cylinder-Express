import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();

  const links = [
    { to: '/about', label: t('footer.about') },
    { to: '/faq', label: t('footer.faq') },
    { to: '/privacy-policy', label: t('footer.privacy') },
    { to: '/terms-of-use', label: t('footer.terms') },
    { to: '/contact-us', label: t('footer.contact') },
  ];

  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <img src="/CylinderExprerssLOGO.png" alt="Cylinder Express" className="h-10 w-10 object-contain" />
            <span className="text-lg font-black text-gray-900">Cylinder<span className="text-blue-600">Express</span></span>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-gray-600">{t('footer.description')}</p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-900">{t('footer.quickLinks')}</h3>
          <div className="space-y-2">
            {links.map((link) => (
              <Link key={link.to} to={link.to} className="block text-sm font-medium text-gray-600 hover:text-blue-700">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-900">{t('footer.support')}</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <a href="tel:+8801967517077" className="flex items-center gap-2 hover:text-blue-700"><Phone className="h-4 w-4" /> +8801967517077</a>
            <a href="tel:+8801409472939" className="flex items-center gap-2 hover:text-blue-700"><Phone className="h-4 w-4" /> +8801409472939</a>
            <a href="mailto:support@cylinderexpress.com" className="flex items-center gap-2 hover:text-blue-700"><Mail className="h-4 w-4" /> support@cylinderexpress.com</a>
            <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4" /> {t('footer.location')}</p>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-100 px-4 py-4 text-center text-xs text-gray-500">
        {t('footer.copyright')}
      </div>
    </footer>
  );
}
