export const tabs = [
  { key: 'categories', label: 'Catégories' },
  { key: 'banks', label: 'Banques' },
  { key: 'paymentMethods', label: 'Moyens de paiement' },
  { key: 'accountTypes', label: 'Types de compte' },
  { key: 'passwordChange', label: 'Changement de mot de passe' },
] as const;

export type SettingsTab = (typeof tabs)[number]['key'];
type Props = {
  activeTab: SettingsTab;
  onChange: (tab: SettingsTab) => void;
};

export function SettingsTabs({ activeTab, onChange }: Readonly<Props>) {
  return (
    <div className="flex gap-2 border-b border-black/10">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-2 border-b-2 ${
            activeTab === t.key ? 'border-black' : 'border-transparent'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
