import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, FormGroup, Input } from '@/components/ui';
import { VersionStatus } from '@/components/VersionStatus.tsx';
import { APP_CONFIG } from '@/constants.ts';
import { useAppVersion } from '@/hooks/useAppVersion.ts';
import { useLogin, useVerifyTotp } from '@/hooks/useAuth';

export function LoginPage() {
  const { t } = useTranslation('common');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const login = useLogin();
  const verifyTotp = useVerifyTotp();
  const { isDev } = useAppVersion();

  const handleCredentialsSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    login.reset();
    login.mutate(
      { username, password },
      {
        onSuccess: (data) => {
          if (data.totp_required) {
            setPendingToken(data.pending_token);
          }
        },
      },
    );
  };

  const handleTotpSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!pendingToken) return;
    verifyTotp.reset();
    verifyTotp.mutate({ pendingToken, code: totpCode });
  };

  const handleBackToCredentials = () => {
    setPendingToken(null);
    setTotpCode('');
    login.reset();
    verifyTotp.reset();
  };

  const loginError = login.error?.message ?? null;
  const totpError = verifyTotp.error?.message ?? null;

  if (pendingToken !== null) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="bg-surface border border-line-subtle rounded-2xl p-8 w-full max-w-sm shadow-lg">
          <h1 className="font-display text-2xl mb-1">
            {APP_CONFIG.name} {isDev && <span className="opacity-50 font-light">(dev)</span>}
          </h1>
          <p className="text-sm text-content-subtle mb-7">{t('login.totp_subtitle')}</p>

          {totpError && (
            <div className="bg-danger-surface border border-danger/30 text-danger text-sm px-3 py-2 rounded-lg mb-5">
              {totpError}
            </div>
          )}

          <form onSubmit={handleTotpSubmit} className="space-y-4">
            <FormGroup
              label={t('login.totp_code')}
              htmlFor="totp-code"
              className="flex-none min-w-0"
            >
              <Input
                id="totp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replaceAll(/\D/g, ''))}
                placeholder="000000"
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </FormGroup>
            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              disabled={totpCode.length !== 6 || verifyTotp.isPending}
            >
              {verifyTotp.isPending ? t('login.submitting') : t('login.totp_submit')}
            </Button>
            <button
              type="button"
              onClick={handleBackToCredentials}
              className="w-full text-sm text-content-muted hover:text-content transition-colors text-center"
            >
              {t('login.totp_back')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="bg-surface border border-line-subtle rounded-2xl p-8 w-full max-w-sm shadow-lg">
        <h1 className="font-display text-2xl mb-1">
          {APP_CONFIG.name} {isDev && <span className="opacity-50 font-light">(dev)</span>}
        </h1>
        <p className="text-sm text-content-subtle mb-7">{t('login.subtitle')}</p>

        {loginError && (
          <div className="bg-danger-surface border border-danger/30 text-danger text-sm px-3 py-2 rounded-lg mb-5">
            {loginError}
          </div>
        )}

        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
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
