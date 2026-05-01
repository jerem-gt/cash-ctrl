import { type SyntheticEvent, useState } from 'react';

import { Button, FormGroup, Input, showToast } from '@/components/ui';
import { useSellStock } from '@/hooks/useStocks';
import { today } from '@/lib/format';
import type { StockPosition } from '@/types';

interface Props {
  accountId: number;
  position?: StockPosition;
  onClose: () => void;
}

export function SellStockModal({ accountId, position, onClose }: Readonly<Props>) {
  const sell = useSellStock(accountId);
  const [ticker, setTicker] = useState(position?.ticker ?? '');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState(position?.current_price ? String(position.current_price) : '');
  const [fees, setFees] = useState('0');
  const [date, setDate] = useState(today());

  const qty = Number.parseFloat(quantity);
  const pps = Number.parseFloat(price);
  const f = Number.parseFloat(fees) || 0;
  const netAmount = qty > 0 && pps > 0 ? qty * pps - f : null;
  const maxQty = position?.quantity;

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ticker.trim() || qty <= 0 || pps <= 0) return;
    sell.mutate(
      { ticker: ticker.trim().toUpperCase(), quantity: qty, price_per_share: pps, fees: f, date },
      {
        onSuccess: () => {
          showToast(`Vente de ${qty} × ${ticker.trim().toUpperCase()} enregistrée ✓`);
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="font-serif text-xl mb-5">Vendre des actions</h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormGroup label="Ticker Yahoo Finance" htmlFor="sell-ticker">
            <Input
              id="sell-ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="ex : DCAM.PA, AAPL"
              disabled={!!position}
              autoFocus={!position}
            />
          </FormGroup>

          <div className="flex gap-3">
            <FormGroup
              label={maxQty != null ? `Nombre d'actions (max ${maxQty})` : "Nombre d'actions"}
              htmlFor="sell-quantity"
            >
              <Input
                id="sell-quantity"
                type="number"
                min="0.001"
                max={maxQty}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="5"
                autoFocus={!!position}
              />
            </FormGroup>
            <FormGroup label="Prix unitaire (€)" htmlFor="sell-price">
              <Input
                id="sell-price"
                type="number"
                min="0.0001"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="13,00"
              />
            </FormGroup>
          </div>

          <div className="flex gap-3">
            <FormGroup label="Frais (€)" htmlFor="sell-fees">
              <Input
                id="sell-fees"
                type="number"
                min="0"
                step="any"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                placeholder="1,50"
              />
            </FormGroup>
            <FormGroup label="Date" htmlFor="sell-date">
              <Input
                id="sell-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </FormGroup>
          </div>

          {netAmount !== null && (
            <div className="bg-stone-50 rounded-xl p-3 border border-stone-200">
              <p className="text-[11px] text-stone-400 uppercase tracking-wider mb-1">
                Montant net reçu
              </p>
              <p
                className={`font-serif text-xl ${netAmount < 0 ? 'text-red-700' : 'text-stone-900'}`}
              >
                {netAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end mt-1">
            <Button type="button" onClick={onClose} disabled={sell.isPending}>
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={sell.isPending || !ticker.trim() || !(qty > 0) || !(pps > 0)}
            >
              {sell.isPending ? '…' : 'Vendre'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
