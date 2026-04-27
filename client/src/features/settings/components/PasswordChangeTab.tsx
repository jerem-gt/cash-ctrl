import { SyntheticEvent, useState } from 'react';

import { Button, Card, CardTitle, FormGroup, Input, showToast } from '@/components/ui.tsx';
import { useChangePassword } from '@/hooks/useAuth.ts';

export function PasswordChangeTab() {
  const changePassword = useChangePassword();
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });

  const handlePasswordSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      showToast('Les mots de passe ne correspondent pas.');
      return;
    }
    if (pwForm.next.length < 8) {
      showToast('Minimum 8 caractères.');
      return;
    }
    changePassword.mutate(
      { current: pwForm.current, next: pwForm.next },
      {
        onSuccess: () => {
          setPwForm({ current: '', next: '', confirm: '' });
          showToast('Mot de passe mis à jour ✓');
        },
        onError: (e) => showToast(e.message),
      },
    );
  };

  return (
    <Card className="max-w-sm">
      <CardTitle>Changer le mot de passe</CardTitle>
      <form onSubmit={handlePasswordSubmit} className="space-y-3">
        <FormGroup label="Mot de passe actuel">
          <Input
            type="password"
            value={pwForm.current}
            onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
            autoComplete="current-password"
          />
        </FormGroup>
        <FormGroup label="Nouveau mot de passe">
          <Input
            type="password"
            value={pwForm.next}
            onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
            placeholder="Min. 8 caractères"
            autoComplete="new-password"
          />
        </FormGroup>
        <FormGroup label="Confirmer">
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
          {changePassword.isPending ? '…' : 'Mettre à jour'}
        </Button>
      </form>
    </Card>
  );
}
