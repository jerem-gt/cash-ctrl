import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';

import { PasswordChangeCard } from '@/components/PasswordChangeCard.tsx';
import {
  AccountTypesManager,
  BackupManager,
  BanksManager,
  CategoriesManager,
  PaymentMethodsManager,
  SettingsManager,
  SettingsTab,
} from '@/features/settings';

import ExportManager from '../features/settings/components/ExportManager.tsx';
import ImportManager from '../features/settings/components/ImportManager.tsx';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('categories');
  const [mobileShowContent, setMobileShowContent] = useState(false);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setMobileShowContent(true);
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-sans tracking-tight">Paramètres</h1>
        <p className="text-sm text-black/40">Administration et gestion de l'application</p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-12">
        <div className={mobileShowContent ? 'hidden md:block' : ''}>
          <SettingsManager activeTab={activeTab} onChange={handleTabChange} />
        </div>

        <div className={`flex-1 min-w-0 ${mobileShowContent ? '' : 'hidden md:block'}`}>
          <button
            onClick={() => setMobileShowContent(false)}
            className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 mb-4 transition-colors md:hidden"
          >
            <ChevronLeft className="h-4 w-4" />
            Paramètres
          </button>
          {activeTab === 'categories' && <CategoriesManager />}
          {activeTab === 'banks' && <BanksManager />}
          {activeTab === 'paymentMethods' && <PaymentMethodsManager />}
          {activeTab === 'accountTypes' && <AccountTypesManager />}
          {activeTab === 'export' && <ExportManager />}
          {activeTab === 'import' && <ImportManager />}
          {activeTab === 'backup' && <BackupManager />}
          {activeTab === 'password' && <PasswordChangeCard />}
        </div>
      </div>
    </div>
  );
}
