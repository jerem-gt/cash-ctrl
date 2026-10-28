import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthCard, authLinkButtonClass } from '@/components/AuthCard';
import { Button, FormGroup, Input } from '@/components/ui';
import { VersionStatus } from '@/components/VersionStatus.tsx';
import { useLogin, useVerifyTotp } from '@/hooks/useAuth';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';

export function LoginPage() {
  const { t } = useTranslation('common');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpRequired, setTotpRequired] = useState(false);
  const [remember, setRemember] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const login = useLogin();
  const verifyTotp = useVerifyTotp();

  const handleCredentialsSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    login.reset();
    login.mutate(
      { username, password },
      {
        onSuccess: (data) => {
          if (data.totp_required) {
            setTotpRequired(true);
          }
        },
      },
    );
  };

  const handleTotpSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    verifyTotp.reset();
    verifyTotp.mutate({ code: totpCode, remember });
  };

  const handleBackToCredentials = () => {
    setTotpRequired(false);
    setTotpCode('');
    setRemember(false);
    login.reset();
    verifyTotp.reset();
  };

  const loginError = login.error?.message ?? null;
  const totpError = verifyTotp.error?.message ?? null;

  if (forgotMode) {
    return <ForgotPasswordPage onBack={() => setForgotMode(false)} />;
  }

  if (totpRequired) {
    return (
      <AuthCard subtitle={t('login.totp_subtitle')} error={totpError}>
        <form onSubmit={handleTotpSubmit} className="space-y-4">
          <FormGroup label={t('login.totp_code')} htmlFor="totp-code" className="flex-none min-w-0">
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
          <label className="flex items-center gap-2 text-sm text-content-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-4 shrink-0 accent-brand"
            />
            {t('login.totp_remember')}
          </label>
          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={totpCode.length !== 6 || verifyTotp.isPending}
          >
            {verifyTotp.isPending ? t('login.submitting') : t('login.totp_submit')}
          </Button>
          <button type="button" onClick={handleBackToCredentials} className={authLinkButtonClass}>
            {t('login.totp_back')}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle={t('login.subtitle')} error={loginError}>
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
        <button type="button" onClick={() => setForgotMode(true)} className={authLinkButtonClass}>
          {t('login.forgot_link')}
        </button>
        <VersionStatus />
      </form>
    </AuthCard>
  );
}
