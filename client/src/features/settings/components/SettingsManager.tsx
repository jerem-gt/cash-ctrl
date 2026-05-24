import { Skeleton } from '@/components/ui';

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
    label: 'Types',
    items: [
      { key: 'categories', label: 'Catégories' },
      { key: 'banks', label: 'Banques' },
      { key: 'paymentMethods', label: 'Moyens de paiement' },
      { key: 'accountTypes', label: 'Types de compte' },
    ],
  },
  {
    section: 'data',
    label: 'Données',
    items: [
      { key: 'export', label: 'Export' },
      { key: 'import', label: 'Import' },
      { key: 'backup', label: 'Backup' },
    ],
  },
  { section: 'security', label: 'Sécurité', items: [{ key: 'password', label: 'Mot de passe' }] },
] as const;

export type SettingsTab = (typeof tabs)[number]['items'][number]['key'];

type Props = {
  activeTab: SettingsTab;
  onChange: (tab: SettingsTab) => void;
};

export function SettingsManager({ activeTab, onChange }: Readonly<Props>) {
  return (
    <nav className="w-full md:w-64 md:shrink-0 flex flex-col gap-1 md:pr-8 md:border-r border-black/5">
      {tabs.map((group) => (
        <div key={group.section} className="mb-4">
          <h3 className="text-[10px] uppercase tracking-widest opacity-30 mb-2">{group.label}</h3>
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
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
