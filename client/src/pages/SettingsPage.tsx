import { useState } from 'react';

import {
  AccountTypesTab,
  BanksTab,
  CategoriesTab,
  PasswordChangeTab,
  PaymentMethodsTab,
  SettingsTab,
  SettingsTabs,
} from '@/features/settings';

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('categories');

  return (
    <>
      <div>
        <h2 className="font-serif text-2xl tracking-tight">Paramètres</h2>
        <p className="text-sm text-stone-400 mt-0.5">Administration et gestion du compte</p>
      </div>
      <div className="p-6 space-y-6">
        <SettingsTabs activeTab={tab} onChange={setTab} />

        {tab === 'categories' && <CategoriesTab />}
        {tab === 'banks' && <BanksTab />}
        {tab === 'paymentMethods' && <PaymentMethodsTab />}
        {tab === 'accountTypes' && <AccountTypesTab />}
        {tab === 'passwordChange' && <PasswordChangeTab />}
      </div>
    </>
  );
}
