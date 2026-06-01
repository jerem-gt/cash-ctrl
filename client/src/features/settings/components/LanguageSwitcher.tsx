import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation('settings');
  const current = i18n.language;

  const handleChange = (lang: 'fr' | 'en') => {
    void i18n.changeLanguage(lang);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] uppercase tracking-widest font-semibold text-stone-400">
        {t('language.title')}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleChange('fr')}
          className={`px-4 py-2 text-sm rounded-xl border transition-all ${
            current === 'fr'
              ? 'bg-brand-600 text-white border-brand-600 shadow-md'
              : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:text-black'
          }`}
        >
          {t('language.fr')}
        </button>
        <button
          type="button"
          onClick={() => handleChange('en')}
          className={`px-4 py-2 text-sm rounded-xl border transition-all ${
            current === 'en' || current.startsWith('en')
              ? 'bg-brand-600 text-white border-brand-600 shadow-md'
              : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:text-black'
          }`}
        >
          {t('language.en')}
        </button>
      </div>
    </div>
  );
}
