import { HelpCircle, ShieldCheck, FileText, Phone, Info, CheckCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type PageKind = 'about' | 'faq' | 'privacy' | 'terms' | 'contact';

const pageIcons = {
  about: Info,
  faq: HelpCircle,
  privacy: ShieldCheck,
  terms: FileText,
  contact: Phone,
};

const bulletKeys: Record<PageKind, string[]> = {
  about: ['about.point1', 'about.point2', 'about.point3', 'about.point4'],
  faq: ['faq.q1', 'faq.q2', 'faq.q3', 'faq.q4', 'faq.q5'],
  privacy: ['privacy.point1', 'privacy.point2', 'privacy.point3', 'privacy.point4', 'privacy.point5'],
  terms: ['terms.point1', 'terms.point2', 'terms.point3', 'terms.point4', 'terms.point5'],
  contact: ['contact.point1', 'contact.point2', 'contact.point3', 'contact.point4'],
};

export default function StaticPage({ type }: { type: PageKind }) {
  const { t } = useLanguage();
  const Icon = pageIcons[type];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 p-8 text-white shadow-xl">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
            <Icon className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black sm:text-4xl">{t(`${type}.title`)}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-blue-50 sm:text-base">{t(`${type}.subtitle`)}</p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <p className="mb-6 text-base leading-8 text-gray-700">{t(`${type}.intro`)}</p>
          <div className="space-y-4">
            {bulletKeys[type].map((key) => (
              <div key={key} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-none text-blue-600" />
                <p className="text-sm leading-7 text-gray-700">{t(key)}</p>
              </div>
            ))}
          </div>

          {type === 'contact' && (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <a href="tel:+8801967517077" className="rounded-2xl bg-blue-50 p-5 font-bold text-blue-800 hover:bg-blue-100">+8801967517077</a>
              <a href="tel:+8801409472939" className="rounded-2xl bg-blue-50 p-5 font-bold text-blue-800 hover:bg-blue-100">+8801409472939</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
