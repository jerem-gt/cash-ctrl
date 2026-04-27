export const tabs = [
  { key: 'categories', label: 'Catégories' },
  { key: 'banks', label: 'Banques' },
  { key: 'paymentMethods', label: 'Moyens de paiement' },
  { key: 'accountTypes', label: 'Types de compte' },
] as const;

export type SettingsTab = (typeof tabs)[number]['key'];

type Props = {
  activeTab: SettingsTab;
  onChange: (tab: SettingsTab) => void;
};

export function SettingsManager({ activeTab, onChange }: Readonly<Props>) {
  return (
    <nav className="w-64 flex flex-col gap-1 pr-8 border-r border-black/5">
      <p className="px-3 mb-2 text-[10px] uppercase tracking-widest text-black/30 font-bold">
        Configuration
      </p>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all ${
            activeTab === t.key
              ? 'bg-black text-white shadow-md'
              : 'text-black/60 hover:bg-black/5 hover:text-black'
          }`}
        >
          <span className="font-medium">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
