import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const { t } = useTranslation('common');

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    globalThis.addEventListener('online', goOnline);
    globalThis.addEventListener('offline', goOffline);
    return () => {
      globalThis.removeEventListener('online', goOnline);
      globalThis.removeEventListener('offline', goOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-surface-strong border border-border px-4 py-2 text-sm text-content-secondary shadow-lg">
      <WifiOff className="h-4 w-4 shrink-0" />
      {t('offline_banner')}
    </div>
  );
}
