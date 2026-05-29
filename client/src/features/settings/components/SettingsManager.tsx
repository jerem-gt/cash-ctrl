import { useTranslation } from 'react-i18next';

import { Skeleton } from '@/components/ui';
import { LanguageSwitcher } from '@/features/settings/components/LanguageSwitcher';

export function SettingsManagerSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-3 w-24" />
      <div className="p-3 bg-stone-50 rounded-2xl border border-dashed border-stone-200 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export const tabs = [
  {
    section: 'types',
    items: [
      { key: 'categories' },
      { key: 'banks' },
      { key: 'paymentMethods' },
      { key: 'accountTypes' },
    ],
  },
  {
    section: 'data',
    items: [{ key: 'export' }, { key: 'import' }, { key: 'backup' }],
  },
  { section: 'security', items: [{ key: 'password' }] },
] as const;

export type SettingsTab = (typeof tabs)[number]['items'][number]['key'];

type Props = {
  activeTab: SettingsTab;
  onChange: (tab: SettingsTab) => void;
};

export function SettingsManager({ activeTab, onChange }: Readonly<Props>) {
  const { t } = useTranslation('settings');

  const sectionLabels: Record<string, string> = {
    types: t('nav.types_section'),
    data: t('nav.data_section'),
    security: t('nav.security_section'),
  };

  const itemLabels: Record<string, string> = {
    categories: t('nav.categories'),
    banks: t('nav.banks'),
    paymentMethods: t('nav.payment_methods'),
    accountTypes: t('nav.account_types'),
    export: t('nav.export'),
    import: t('nav.import'),
    backup: t('nav.backup'),
    password: t('nav.password'),
  };

  return (
    <nav className="w-full md:w-64 md:shrink-0 flex flex-col gap-1 md:pr-8 md:border-r border-black/5">
      {tabs.map((group) => (
        <div key={group.section} className="mb-4">
          <h3 className="text-[10px] uppercase tracking-widest opacity-30 mb-2">
            {sectionLabels[group.section]}
          </h3>
          <div className="flex flex-col">
            {group.items.map((item) => (
              <button
                key={item.key}
                onClick={() => onChange(item.key)}
                className={`flex items-center gap-3 px-3 py-2 text-sm rounded-xl transition-all ${
                  activeTab === item.key
                    ? 'bg-black text-white shadow-md'
                    : 'text-black/60 hover:bg-black/5 hover:text-black'
                }`}
              >
                <span className="font-medium">{itemLabels[item.key]}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
<div className="mt-4 pt-4 border-t border-black/5">
  <LanguageSwitcher />
</div>;
