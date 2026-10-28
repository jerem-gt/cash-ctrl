import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { MeData, ProfileUpdatePayload } from '@/api/client';
import { Button, Card, CardTitle, FormGroup, Input, showToast } from '@/components/ui';
import { useMe, useSendTestEmail, useUpdateProfile } from '@/hooks/useAuth';

export function ProfileCard() {
  const { data: me } = useMe();
  // Le formulaire s'initialise depuis le profil : on attend qu'il soit chargé
  return me ? <ProfileForm me={me} /> : null;
}

function ProfileForm({ me }: Readonly<{ me: MeData }>) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const updateProfile = useUpdateProfile();
  const testEmail = useSendTestEmail();
  const [username, setUsername] = useState(me.username);
  const [email, setEmail] = useState(me.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');

  const currentEmail = me.email ?? '';
  const trimmedEmail = email.trim();
  const usernameChanged = username.trim() !== me.username;
  const emailChanged = trimmedEmail !== currentEmail;
  const canSubmit =
    (usernameChanged || emailChanged) &&
    username.trim() !== '' &&
    currentPassword !== '' &&
    !updateProfile.isPending;

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const payload: ProfileUpdatePayload = { current_password: currentPassword };
    if (usernameChanged) payload.username = username.trim();
    if (emailChanged) payload.email = trimmedEmail === '' ? null : trimmedEmail;
    updateProfile.mutate(payload, {
      onSuccess: (data) => {
        setUsername(data.username);
        setEmail(data.email ?? '');
        setCurrentPassword('');
        showToast(t('profile.success'));
      },
    });
  };

  const handleTestEmail = () => {
    testEmail.mutate(undefined, { onSuccess: () => showToast(t('profile.test_email_sent')) });
  };

  return (
    <Card className="max-w-sm">
      <CardTitle>{t('profile.title')}</CardTitle>
      <form onSubmit={handleSubmit} className="space-y-3">
        <FormGroup label={t('profile.username')} htmlFor="profile-username">
          <Input
            id="profile-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            maxLength={64}
          />
        </FormGroup>
        <FormGroup label={t('profile.email')} htmlFor="profile-email" optional>
          <div className="flex gap-2">
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('profile.email_placeholder')}
              autoComplete="email"
            />
            {email !== '' && (
              <Button type="button" onClick={() => setEmail('')}>
                {t('profile.clear_email')}
              </Button>
            )}
          </div>
        </FormGroup>
        <FormGroup label={t('profile.current_password')} htmlFor="profile-password">
          <Input
            id="profile-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </FormGroup>
        <Button type="submit" variant="primary" disabled={!canSubmit} className="mt-2">
          {updateProfile.isPending ? tc('loading') : t('profile.submit')}
        </Button>
      </form>
      {me.isAdmin && (
        <div className="mt-5 pt-4 border-t border-line-subtle space-y-2">
          <p className="text-xs text-content-subtle">{t('profile.test_email_help')}</p>
          <Button type="button" onClick={handleTestEmail} disabled={testEmail.isPending}>
            {testEmail.isPending ? tc('loading') : t('profile.test_email_btn')}
          </Button>
        </div>
      )}
    </Card>
  );
}
