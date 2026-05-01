import { type SyntheticEvent, useState } from 'react';

import { Button, FormGroup, Input, showToast } from '@/components/ui';
import { useBuyStock } from '@/hooks/useStocks';
import { today } from '@/lib/format';

interface Props {
  accountId: number;
  onClose: () => void;
}

export function BuyStockModal({ accountId, onClose }: Readonly<Props>) {
  const buy = useBuyStock(accountId);
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fees, setFees] = useState('0');
  const [date, setDate] = useState(today());

  const qty = Number.parseFloat(quantity);
  const pps = Number.parseFloat(price);
  const f = Number.parseFloat(fees) || 0;
  const total = qty > 0 && pps > 0 ? qty * pps + f : null;

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ticker.trim() || qty <= 0 || pps <= 0) return;
    buy.mutate(
      { ticker: ticker.trim().toUpperCase(), quantity: qty, price_per_share: pps, fees: f, date },
      {
        onSuccess: () => {
          showToast(`Achat de ${qty} × ${ticker.trim().toUpperCase()} enregistré ✓`);
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="font-serif text-xl mb-5">Acheter des actions</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormGroup label="Ticker Yahoo Finance" htmlFor="ticker">
            <Input
              id="ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="ex : DCAM.PA, AAPL"
              autoFocus
            />
          </FormGroup>

          <div className="flex gap-3">
            <FormGroup label="Nombre d'actions" htmlFor="quantity">
              <Input
                id="quantity"
                type="number"
                min="0.001"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
              />
            </FormGroup>
            <FormGroup label="Prix unitaire (€)" htmlFor="price">
              <Input
                id="price"
                type="number"
                min="0.0001"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="12,50"
              />
            </FormGroup>
          </div>

          <div className="flex gap-3">
            <FormGroup label="Frais (€)" htmlFor="fees">
              <Input
                id="fees"
                type="number"
                min="0"
                step="any"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                placeholder="1,50"
              />
            </FormGroup>
            <FormGroup label="Date" htmlFor="date">
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormGroup>
          </div>

          {total !== null && (
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-200">
              <p className="text-[11px] text-stone-400 uppercase tracking-wider mb-1">
                Total dépense
              </p>
              <p className="font-serif text-xl text-stone-900">
                {total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end mt-1">
            <Button type="button" onClick={onClose} disabled={buy.isPending}>
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={buy.isPending || !ticker.trim() || !(qty > 0) || !(pps > 0)}
            >
              {buy.isPending ? '…' : 'Acheter'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
