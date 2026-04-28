import { useState } from 'react';

import {
  AccountTypesManager,
  BanksManager,
  CategoriesManager,
  PaymentMethodsManager,
  SettingsManager,
  SettingsTab,
} from '@/features/settings';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('categories');

  return (
    <div className="flex flex-col gap-8">
      {/* Header de la page */}
      <div>
        <h1 className="text-3xl font-serif tracking-tight">Paramètres</h1>
        <p className="text-sm text-black/40">Administration et gestion de l'application</p>
      </div>

      {/* Layout Main */}
      <div className="flex items-start gap-12">
        {/* Menu Gauche */}
        <SettingsManager activeTab={activeTab} onChange={setActiveTab} />

        {/* Contenu Droite */}
        <div className="flex-1 min-w-0">
          {activeTab === 'categories' && <CategoriesManager />}
          {activeTab === 'banks' && <BanksManager />}
          {activeTab === 'paymentMethods' && <PaymentMethodsManager />}
          {activeTab === 'accountTypes' && <AccountTypesManager />}
        </div>
      </div>
    </div>
  );
}
