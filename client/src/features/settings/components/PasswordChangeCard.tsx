import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Card, CardTitle, FormGroup, Input, showToast } from '@/components/ui';
import { useChangePassword } from '@/hooks/useAuth';

export function PasswordChangeCard() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const changePassword = useChangePassword();
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Set<string>>(new Set());

  const handlePasswordSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      setErrors(new Set(['confirm']));
      showToast(t('password.err_mismatch'));
      return;
    }
    if (pwForm.next.length < 8) {
      setErrors(new Set(['next']));
      showToast(t('password.err_too_short'));
      return;
    }
    setErrors(new Set());
    changePassword.mutate(
      { current: pwForm.current, next: pwForm.next },
      {
        onSuccess: () => {
          setPwForm({ current: '', next: '', confirm: '' });
          showToast(t('password.success'));
        },
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
            onChange={(e) => {
              setErrors((p) => {
                const s = new Set(p);
                s.delete('next');
                return s;
              });
              setPwForm((f) => ({ ...f, next: e.target.value }));
            }}
            placeholder={t('password.new_placeholder')}
            autoComplete="new-password"
            error={errors.has('next')}
          />
        </FormGroup>
        <FormGroup label={t('password.confirm')}>
          <Input
            type="password"
            value={pwForm.confirm}
            onChange={(e) => {
              setErrors((p) => {
                const s = new Set(p);
                s.delete('confirm');
                return s;
              });
              setPwForm((f) => ({ ...f, confirm: e.target.value }));
            }}
            autoComplete="new-password"
            error={errors.has('confirm')}
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
