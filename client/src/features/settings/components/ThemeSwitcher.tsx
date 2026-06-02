import type { LucideIcon } from 'lucide-react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { setTheme, type ThemeMode, useTheme } from '@/hooks/useTheme';

const OPTIONS: ReadonlyArray<{ mode: ThemeMode; icon: LucideIcon }> = [
  { mode: 'light', icon: Sun },
  { mode: 'dark', icon: Moon },
  { mode: 'system', icon: Monitor },
];

export function ThemeSwitcher() {
  const { t } = useTranslation('settings');
  const current = useTheme();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] uppercase tracking-widest font-semibold text-content-subtle">
        {t('theme.title')}
      </p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(({ mode, icon: Icon }) => {
          const active = current === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setTheme(mode)}
              aria-pressed={active}
              className={`flex flex-1 min-w-[4.5rem] items-center justify-center gap-1.5 px-2.5 py-2 text-sm rounded-xl border transition-all ${
                active
                  ? 'bg-brand-600 text-white border-brand-600 shadow-md'
                  : 'bg-surface text-content-secondary border-line hover:border-line-strong hover:text-content'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(`theme.${mode}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
