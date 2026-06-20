import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Card, CardTitle, FormGroup, Input, showToast } from '@/components/ui';
import { useDisable2FA, useEnable2FA, useMe, useSetup2FA } from '@/hooks/useAuth';

type TotpStep = 'idle' | 'setup' | 'disable';

export function TwoFactorCard() {
  const { t } = useTranslation('settings');
  const { data: me } = useMe();
  const [step, setStep] = useState<TotpStep>('idle');
  const [setupData, setSetupData] = useState<{ uri: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  const setup2fa = useSetup2FA();
  const enable2fa = useEnable2FA();
  const disable2fa = useDisable2FA();

  const totpEnabled = me?.totpEnabled ?? false;

  const handleStartSetup = () => {
    setup2fa.mutate(undefined, {
      onSuccess: (data) => {
        setSetupData(data);
        setCode('');
        setStep('setup');
      },
    });
  };

  const handleEnable = () => {
    if (!setupData) return;
    enable2fa.mutate(
      { secret: setupData.secret, code },
      {
        onSuccess: () => {
          showToast(t('totp.success_enabled'));
          setStep('idle');
          setSetupData(null);
          setCode('');
        },
      },
    );
  };

  const handleDisable = () => {
    disable2fa.mutate(
      { password },
      {
        onSuccess: () => {
          showToast(t('totp.success_disabled'));
          setStep('idle');
          setPassword('');
        },
      },
    );
  };

  const handleCancel = () => {
    setStep('idle');
    setSetupData(null);
    setCode('');
    setPassword('');
  };

  if (step === 'setup' && setupData) {
    return (
      <Card className="max-w-sm">
        <CardTitle>{t('totp.setup_title')}</CardTitle>
        <p className="text-sm text-content-muted mb-4">{t('totp.setup_step1')}</p>
        <div className="flex justify-center mb-4 p-3 bg-white rounded-xl border border-line-subtle">
          <QRCodeSVG value={setupData.uri} size={160} />
        </div>
        <p className="text-xs text-content-faint mb-1">{t('totp.setup_secret_label')}</p>
        <p className="font-mono text-xs text-content-secondary bg-canvas px-3 py-2 rounded-lg mb-4 break-all select-all">
          {setupData.secret}
        </p>
        <p className="text-sm text-content-muted mb-3">{t('totp.setup_step2')}</p>
        <FormGroup label="">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replaceAll(/\D/g, ''))}
            placeholder={t('totp.code_placeholder')}
            autoFocus
            autoComplete="one-time-code"
          />
        </FormGroup>
        <div className="flex gap-2 mt-3">
          <Button
            variant="primary"
            onClick={handleEnable}
            disabled={code.length !== 6 || enable2fa.isPending}
          >
            {t('totp.confirm_btn')}
          </Button>
          <Button variant="default" onClick={handleCancel}>
            {t('totp.cancel')}
          </Button>
        </div>
      </Card>
    );
  }

  if (step === 'disable') {
    return (
      <Card className="max-w-sm">
        <CardTitle>{t('totp.disable_title')}</CardTitle>
        <p className="text-sm text-content-muted mb-4">{t('totp.disable_desc')}</p>
        <FormGroup label={t('totp.password_label')} htmlFor="disable-totp-password">
          <Input
            id="disable-totp-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
        </FormGroup>
        <div className="flex gap-2 mt-3">
          <Button
            variant="danger"
            onClick={handleDisable}
            disabled={!password || disable2fa.isPending}
          >
            {t('totp.disable_btn')}
          </Button>
          <Button variant="default" onClick={handleCancel}>
            {t('totp.cancel')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-sm">
      <CardTitle>{t('totp.title')}</CardTitle>
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${totpEnabled ? 'bg-success' : 'bg-content-faint'}`}
        />
        <span
          className={`text-sm font-medium ${totpEnabled ? 'text-success' : 'text-content-muted'}`}
        >
          {totpEnabled ? t('totp.status_enabled') : t('totp.status_disabled')}
        </span>
      </div>
      <p className="text-sm text-content-muted mb-4">
        {totpEnabled ? t('totp.description_enabled') : t('totp.description_disabled')}
      </p>
      {totpEnabled ? (
        <Button variant="danger" onClick={() => setStep('disable')}>
          {t('totp.disable_btn')}
        </Button>
      ) : (
        <Button variant="primary" onClick={handleStartSetup} disabled={setup2fa.isPending}>
          {t('totp.enable_btn')}
        </Button>
      )}
    </Card>
  );
}
