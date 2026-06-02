import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, FormGroup, Input } from '@/components/ui';
import { VersionStatus } from '@/components/VersionStatus.tsx';
import { APP_CONFIG } from '@/constants.ts';
import { useAppVersion } from '@/hooks/useAppVersion.ts';
import { useLogin } from '@/hooks/useAuth';

export function LoginPage() {
  const { t } = useTranslation('common');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const { isDev } = useAppVersion();

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    login.reset();
    login.mutate({ username, password });
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="bg-surface border border-line-subtle rounded-2xl p-8 w-full max-w-sm shadow-lg">
        <h1 className="font-display text-2xl mb-1">
          {APP_CONFIG.name} {isDev && <span className="opacity-50 font-light">(dev)</span>}
        </h1>
        <p className="text-sm text-content-subtle mb-7">{t('login.subtitle')}</p>

        {login.error && (
          <div className="bg-danger-surface border border-danger/30 text-danger text-sm px-3 py-2 rounded-lg mb-5">
            {login.error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormGroup label={t('login.username')} htmlFor="username" className="flex-none min-w-0">
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="admin"
              autoFocus
              required
            />
          </FormGroup>
          <FormGroup label={t('login.password')} htmlFor="password" className="flex-none min-w-0">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </FormGroup>
          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={!username || !password || login.isPending}
          >
            {login.isPending ? t('login.submitting') : t('login.submit')}
          </Button>
          <VersionStatus />
        </form>
      </div>
    </div>
  );
}
