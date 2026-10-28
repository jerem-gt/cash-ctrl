import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthCard } from '@/components/AuthCard';
import { Button, FormGroup, Input } from '@/components/ui';
import { useSetup } from '@/hooks/useAuth';

export function SetupPage() {
  const { t, i18n } = useTranslation('common');
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const setup = useSetup();

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    setup.reset();
    if (password.length < 8) {
      setLocalError(t('setup.err_too_short'));
      return;
    }
    if (password !== confirm) {
      setLocalError(t('setup.err_mismatch'));
      return;
    }
    setLocalError(null);
    const lang = i18n.language.startsWith('en') ? 'en' : 'fr';
    setup.mutate({ token: token.trim(), username: username.trim(), password, lang });
  };

  const canSubmit = token.trim() !== '' && username.trim() !== '' && password !== '';

  return (
    <AuthCard subtitle={t('setup.subtitle')} error={localError ?? setup.error?.message ?? null}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGroup label={t('setup.token')} htmlFor="setup-token" className="flex-none min-w-0">
          <Input
            id="setup-token"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            autoFocus
            required
          />
          <p className="text-xs text-content-subtle mt-1">{t('setup.token_help')}</p>
        </FormGroup>
        <FormGroup
          label={t('setup.username')}
          htmlFor="setup-username"
          className="flex-none min-w-0"
        >
          <Input
            id="setup-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            maxLength={64}
            required
          />
        </FormGroup>
        <FormGroup
          label={t('setup.password')}
          htmlFor="setup-password"
          className="flex-none min-w-0"
        >
          <Input
            id="setup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('setup.password_placeholder')}
            autoComplete="new-password"
            required
          />
        </FormGroup>
        <FormGroup label={t('setup.confirm')} htmlFor="setup-confirm" className="flex-none min-w-0">
          <Input
            id="setup-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </FormGroup>
        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          disabled={!canSubmit || setup.isPending}
        >
          {setup.isPending ? t('setup.submitting') : t('setup.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
