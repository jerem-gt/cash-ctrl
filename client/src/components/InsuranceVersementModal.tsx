import { useState } from 'react';

import { insuranceApi } from '@/api/client';
import { useVersement } from '@/hooks/useInsurance';
import { today } from '@/lib/format';
import type { InsuranceSupportView } from '@/types';

import { Button, FormGroup, Input, showToast } from './ui';

interface Props {
  accountId: number;
  support: InsuranceSupportView;
  onClose: () => void;
}

export function InsuranceVersementModal({ accountId, support, onClose }: Readonly<Props>) {
  const [amount, setAmount] = useState('');
  const [vl, setVl] = useState(support.current_price != null ? String(support.current_price) : '');
  const [fees, setFees] = useState('0');
  const [date, setDate] = useState(today());
  const [vlLoading, setVlLoading] = useState(false);
  const versement = useVersement(accountId);

  const isUc = support.type === 'uc';
  const amountNum = Number.parseFloat(amount) || 0;
  const vlNum = Number.parseFloat(vl) || 0;
  const quantity = isUc && vlNum > 0 ? amountNum / vlNum : null;

  const fetchVl = async () => {
    if (!support.ticker) return;
    setVlLoading(true);
    try {
      const price = await insuranceApi.price(support.ticker);
      setVl(String(price.price));
    } catch {
      showToast('VL introuvable');
    } finally {
      setVlLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    versement.mutate(
      {
        support_id: support.id,
        amount: amountNum,
        quantity: isUc ? quantity : null,
        price_per_unit: isUc ? vlNum : null,
        fees: Number.parseFloat(fees) || 0,
        date,
      },
      {
        onSuccess: () => {
          showToast('Versement enregistré ✓');
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="font-sans text-xl mb-5">Versement — {support.name}</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormGroup label="Montant versé (€)" htmlFor="vers-amount">
            <Input
              id="vers-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus={!isUc}
            />
          </FormGroup>

          {isUc && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="vers-vl"
                  className="text-[11px] font-medium uppercase tracking-wider text-stone-400"
                >
                  VL (€ / part)
                </label>
                {support.ticker && (
                  <button
                    type="button"
                    onClick={fetchVl}
                    disabled={vlLoading}
                    className="text-[10px] text-blue-500 hover:text-blue-700 disabled:opacity-50"
                  >
                    {vlLoading ? '…' : '↻ Récupérer'}
                  </button>
                )}
              </div>
              <Input
                id="vers-vl"
                type="number"
                step="0.000001"
                min="0.000001"
                value={vl}
                onChange={(e) => setVl(e.target.value)}
                required
              />
              {quantity != null && vlNum > 0 && (
                <p className="text-[10px] text-stone-400">≈ {quantity.toFixed(6)} parts allouées</p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <FormGroup label="Frais (€)" htmlFor="vers-fees">
              <Input
                id="vers-fees"
                type="number"
                step="0.01"
                min="0"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
              />
            </FormGroup>
            <FormGroup label="Date" htmlFor="vers-date">
              <Input
                id="vers-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </FormGroup>
          </div>

          <div className="flex gap-2 justify-end mt-1">
            <Button type="button" onClick={onClose} disabled={versement.isPending}>
              Annuler
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!amount || (isUc && !vl) || versement.isPending}
            >
              {versement.isPending ? '…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
