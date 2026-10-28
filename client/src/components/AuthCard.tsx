import type { ReactNode } from 'react';

import { APP_CONFIG } from '@/constants.ts';
import { useAppVersion } from '@/hooks/useAppVersion.ts';

interface Props {
  subtitle: string;
  error?: string | null;
  children: ReactNode;
}

// Cadre commun des écrans hors session (installation, mot de passe oublié, réinitialisation)
export function AuthCard({ subtitle, error = null, children }: Readonly<Props>) {
  const { isDev } = useAppVersion();
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="bg-surface border border-line-subtle rounded-2xl p-8 w-full max-w-sm shadow-lg">
        <h1 className="font-display text-2xl mb-1">
          {APP_CONFIG.name} {isDev && <span className="opacity-50 font-light">(dev)</span>}
        </h1>
        <p className="text-sm text-content-subtle mb-7">{subtitle}</p>
        {error && (
          <div className="bg-danger-surface border border-danger/30 text-danger text-sm px-3 py-2 rounded-lg mb-5">
            {error}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
