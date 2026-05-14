import { useState } from 'react';

import { useCreateInsuranceSupport } from '@/hooks/useInsurance';
import type { InsuranceSupportType } from '@/types';

import { Button, FormGroup, Input, showToast } from './ui';

interface Props {
  accountId: number;
  onClose: () => void;
}

export function AddInsuranceSupportModal({ accountId, onClose }: Readonly<Props>) {
  const [name, setName] = useState('');
  const [type, setType] = useState<InsuranceSupportType>('euro');
  const [ticker, setTicker] = useState('');
  const create = useCreateInsuranceSupport(accountId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name, type, ticker: type === 'uc' && ticker ? ticker : null },
      {
        onSuccess: () => {
          showToast('Support créé ✓');
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="font-sans text-xl mb-5">Ajouter un support</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormGroup label="Nom du support" htmlFor="add-support-name">
            <Input
              id="add-support-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Fonds Euro Sécurité, Amundi MSCI World"
              required
              autoFocus
            />
          </FormGroup>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
              Type
            </span>
            <div className="flex gap-4">
              {(['euro', 'uc'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="support-type"
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                  />
                  {t === 'euro' ? 'Fonds euro' : 'UC (unité de compte)'}
                </label>
              ))}
            </div>
          </div>

          {type === 'uc' && (
            <FormGroup label="Ticker Yahoo Finance" htmlFor="add-support-ticker">
              <Input
                id="add-support-ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="ex: LU1681043599.SW"
                className="font-mono"
              />
            </FormGroup>
          )}

          <div className="flex gap-2 justify-end mt-1">
            <Button type="button" onClick={onClose} disabled={create.isPending}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" disabled={!name || create.isPending}>
              Ajouter
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
