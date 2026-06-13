import { Mail, MapPin, Phone, MessageCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function ContactUsPage() {
  const { t } = useLanguage();
  const contacts = [
    { icon: Phone, label: t('contact.phone1'), value: '+8801967517077', href: 'tel:+8801967517077' },
    { icon: Phone, label: t('contact.phone2'), value: '+8801409472939', href: 'tel:+8801409472939' },
    { icon: Mail, label: t('contact.email'), value: 'support@cylinderexpress.com', href: 'mailto:support@cylinderexpress.com' },
    { icon: MessageCircle, label: t('contact.support'), value: t('contact.supportValue'), href: '#/orders' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 px-4 py-12 text-white sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Phone className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black sm:text-4xl">{t('contact.title')}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-100 sm:text-base">{t('contact.subtitle')}</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {contacts.map(({ icon: Icon, label, value, href }) => (
            <a key={label} href={href} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
              <Icon className="mb-4 h-7 w-7 text-blue-600" />
              <p className="text-sm font-bold text-gray-500">{label}</p>
              <p className="mt-1 text-lg font-black text-gray-900">{value}</p>
            </a>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <MapPin className="mt-1 h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-black text-gray-900">{t('contact.officeTitle')}</h2>
              <p className="mt-2 text-sm leading-7 text-gray-600">{t('contact.officeBody')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
