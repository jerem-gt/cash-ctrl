import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { ApiError } from '@/api/client';
import { AuthCard } from '@/components/AuthCard';
import { Button, FormGroup, Input } from '@/components/ui';
import { useResetPassword } from '@/hooks/useAuth';

const TOKEN_INVALID_CODE = 'auth.reset_token_invalid';

export function ResetPasswordPage() {
  const { t } = useTranslation('common');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const reset = useResetPassword();

  const linkClass = 'block text-sm text-content-muted hover:text-content text-center underline';

  const tokenInvalid =
    token === '' ||
    (reset.error instanceof ApiError && reset.error.body?.code === TOKEN_INVALID_CODE);

  if (tokenInvalid) {
    return (
      <AuthCard subtitle={t('reset.invalid_token')}>
        <Link to="/" className={linkClass}>
          {t('reset.request_new')}
        </Link>
      </AuthCard>
    );
  }

  if (reset.isSuccess) {
    return (
      <AuthCard subtitle={t('reset.success')}>
        <Link to="/" replace className={linkClass}>
          {t('reset.to_login')}
        </Link>
      </AuthCard>
    );
  }

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    reset.reset();
    if (password.length < 8) {
      setLocalError(t('reset.err_too_short'));
      return;
    }
    if (password !== confirm) {
      setLocalError(t('reset.err_mismatch'));
      return;
    }
    setLocalError(null);
    reset.mutate({ token, password });
  };

  return (
    <AuthCard subtitle={t('reset.subtitle')} error={localError ?? reset.error?.message ?? null}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGroup
          label={t('reset.password')}
          htmlFor="reset-password"
          className="flex-none min-w-0"
        >
          <Input
            id="reset-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
            required
          />
        </FormGroup>
        <FormGroup label={t('reset.confirm')} htmlFor="reset-confirm" className="flex-none min-w-0">
          <Input
            id="reset-confirm"
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
          disabled={password === '' || reset.isPending}
        >
          {reset.isPending ? t('reset.submitting') : t('reset.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}
