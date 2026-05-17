import { type SyntheticEvent, useState } from 'react';

import { isIsin, TickerInput } from '@/components/TickerInput';
import { Button, DecimalInput, FormGroup, Input, showToast } from '@/components/ui';
import { useBuyStock, useSellStock } from '@/hooks/useStocks';
import { today } from '@/lib/format';
import { calculateTotalAmount } from '@/lib/stock.ts';
import type { StockPosition } from '@/types';

interface BuyProps {
  mode: 'buy';
  accountId: number;
  position?: StockPosition;
  onClose: () => void;
}

interface SellProps {
  mode: 'sell';
  accountId: number;
  position?: StockPosition;
  onClose: () => void;
}

type Props = BuyProps | SellProps;

export function StockOperationModal(props: Readonly<Props>) {
  const { mode, accountId, onClose } = props;
  const position = mode === 'sell' ? (props as SellProps).position : (props as BuyProps).position;

  const buy = useBuyStock(accountId);
  const sell = useSellStock(accountId);
  const mutation = mode === 'buy' ? buy : sell;

  const [ticker, setTicker] = useState(position?.ticker ?? '');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState(position?.current_price ? String(position.current_price) : '');
  const [fees, setFees] = useState('0');
  const [date, setDate] = useState(today());

  const qty = Number.parseFloat(quantity) || 0;
  const pps = Number.parseFloat(price) || 0;
  const f = Number.parseFloat(fees) || 0;
  const amount = calculateTotalAmount(mode, qty, pps, f);

  const isBuy = mode === 'buy';
  const maxQty = isBuy ? undefined : position?.quantity;
  const actionLabel = isBuy ? 'Acheter' : 'Vendre';

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ticker.trim() || qty <= 0 || pps <= 0) return;
    const cleanTicker = ticker.trim().toUpperCase();
    mutation.mutate(
      { ticker: cleanTicker, quantity: qty, price_per_share: pps, fees: f, date },
      {
        onSuccess: () => {
          showToast(
            isBuy
              ? `Achat de ${qty} × ${cleanTicker} enregistré ✓`
              : `Vente de ${qty} × ${cleanTicker} enregistrée ✓`,
          );
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className="font-sans text-xl mb-5">
          {isBuy ? 'Acheter des actions' : 'Vendre des actions'}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormGroup label="Ticker ou ISIN" htmlFor="op-ticker">
            <TickerInput
              id="op-ticker"
              value={ticker}
              onChange={setTicker}
              placeholder="ex : DCAM.PA, AAPL ou FR0014000MR3"
              disabled={!!position}
              autoFocus={!position}
            />
          </FormGroup>

          <div className="flex gap-3">
            <FormGroup
              label={maxQty == null ? "Nombre d'actions" : `Nombre d'actions (max ${maxQty})`}
              htmlFor="op-quantity"
            >
              <Input
                id="op-quantity"
                type="number"
                min="0.001"
                max={maxQty}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={isBuy ? '10' : '5'}
                autoFocus={!!position}
              />
            </FormGroup>
            <FormGroup label="Prix unitaire (€)" htmlFor="op-price">
              <DecimalInput
                id="op-price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={isBuy ? '12,50' : '13,00'}
              />
            </FormGroup>
          </div>

          <div className="flex gap-3">
            <FormGroup label="Frais (€)" htmlFor="op-fees">
              <DecimalInput
                id="op-fees"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                placeholder="1,50"
              />
            </FormGroup>
            <FormGroup label="Date" htmlFor="op-date">
              <Input
                id="op-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </FormGroup>
          </div>

          <div className="bg-stone-50 rounded-xl p-3 border border-stone-200">
            <p className="text-[11px] text-stone-400 uppercase tracking-wider mb-1">
              {isBuy ? 'Total dépense' : 'Montant net reçu'}
            </p>
            <p className={`font-sans text-xl ${amount < 0 ? 'text-red-700' : 'text-stone-900'}`}>
              {amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </p>
          </div>

          <div className="flex gap-2 justify-end mt-1">
            <Button type="button" onClick={onClose} disabled={mutation.isPending}>
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={
                mutation.isPending ||
                !ticker.trim() ||
                isIsin(ticker.trim()) ||
                qty <= 0 ||
                pps <= 0
              }
            >
              {mutation.isPending ? '…' : actionLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
