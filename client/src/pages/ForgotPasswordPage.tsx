import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthCard, authLinkButtonClass } from '@/components/AuthCard';
import { Button, FormGroup, Input } from '@/components/ui';
import { useForgotPassword } from '@/hooks/useAuth';
import { currentLang } from '@/lib/format';

export function ForgotPasswordPage({ onBack }: Readonly<{ onBack: () => void }>) {
  const { t } = useTranslation('common');
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(false);
  const forgot = useForgotPassword();

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    // Message neutre identique quel que soit le résultat (pas d'énumération de comptes)
    forgot.mutate(
      { identifier: identifier.trim(), lang: currentLang() },
      { onSettled: () => setSent(true) },
    );
  };

  const backButton = (
    <button type="button" onClick={onBack} className={authLinkButtonClass}>
      {t('forgot.back')}
    </button>
  );

  if (sent) {
    return (
      <AuthCard subtitle={t('forgot.sent')}>
        <div className="space-y-4">{backButton}</div>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle={t('forgot.subtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormGroup
          label={t('forgot.identifier')}
          htmlFor="forgot-identifier"
          className="flex-none min-w-0"
        >
          <Input
            id="forgot-identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </FormGroup>
        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          disabled={identifier.trim() === '' || forgot.isPending}
        >
          {forgot.isPending ? t('forgot.submitting') : t('forgot.submit')}
        </Button>
        {backButton}
      </form>
    </AuthCard>
  );
}
