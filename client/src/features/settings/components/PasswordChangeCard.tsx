import { SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Card, CardTitle, FormGroup, Input, showToast } from '@/components/ui';
import { useChangePassword } from '@/hooks/useAuth';

export function PasswordChangeCard() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const changePassword = useChangePassword();
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });

  const handlePasswordSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      showToast(t('password.err_mismatch'));
      return;
    }
    if (pwForm.next.length < 8) {
      showToast(t('password.err_too_short'));
      return;
    }
    changePassword.mutate(
      { current: pwForm.current, next: pwForm.next },
      {
        onSuccess: () => {
          setPwForm({ current: '', next: '', confirm: '' });
          showToast(t('password.success'));
        },
        onError: (e) => showToast(e.message),
      },
    );
  };

  return (
    <Card className="max-w-sm">
      <CardTitle>{t('password.title')}</CardTitle>
      <form onSubmit={handlePasswordSubmit} className="space-y-3">
        <FormGroup label={t('password.current')}>
          <Input
            type="password"
            value={pwForm.current}
            onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
            autoComplete="current-password"
          />
        </FormGroup>
        <FormGroup label={t('password.new')}>
          <Input
            type="password"
            value={pwForm.next}
            onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
            placeholder={t('password.new_placeholder')}
            autoComplete="new-password"
          />
        </FormGroup>
        <FormGroup label={t('password.confirm')}>
          <Input
            type="password"
            value={pwForm.confirm}
            onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
            autoComplete="new-password"
          />
        </FormGroup>
        <Button
          type="submit"
          variant="primary"
          disabled={changePassword.isPending}
          className="mt-2"
        >
          {changePassword.isPending ? tc('loading') : t('password.submit')}
        </Button>
      </form>
    </Card>
  );
}
