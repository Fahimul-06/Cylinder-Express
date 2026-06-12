import { Languages } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className={`inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm ${compact ? 'text-xs' : 'text-sm'}`}>
      {!compact && <Languages className="w-4 h-4 text-gray-500 ml-1" />}
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${language === 'en' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
        aria-label="Switch to English"
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('bn')}
        className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${language === 'bn' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
        aria-label="Switch to Bangla"
      >
        বাংলা
      </button>
      <span className="sr-only">{t('language.label')}</span>
    </div>
  );
}
