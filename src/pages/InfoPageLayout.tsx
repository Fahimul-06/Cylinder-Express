import { LucideIcon } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type Section = {
  titleKey: string;
  bodyKeys: string[];
};

type InfoPageLayoutProps = {
  icon: LucideIcon;
  titleKey: string;
  subtitleKey: string;
  sections: Section[];
  heroNoteKey?: string;
};

export default function InfoPageLayout({ icon: Icon, titleKey, subtitleKey, sections, heroNoteKey }: InfoPageLayoutProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 px-4 py-12 text-white sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Icon className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black sm:text-4xl">{t(titleKey)}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-100 sm:text-base">{t(subtitleKey)}</p>
          {heroNoteKey && (
            <p className="mt-5 inline-flex rounded-full bg-white/15 px-4 py-2 text-xs font-bold text-white backdrop-blur">
              {t(heroNoteKey)}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid gap-5">
          {sections.map((section) => (
            <section key={section.titleKey} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="mb-3 text-xl font-black text-gray-900">{t(section.titleKey)}</h2>
              <div className="space-y-3">
                {section.bodyKeys.map((bodyKey) => (
                  <p key={bodyKey} className="text-sm leading-7 text-gray-600 sm:text-base">
                    {t(bodyKey)}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
