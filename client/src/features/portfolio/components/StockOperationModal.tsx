import type { StockPosition } from '@cashctrl/types';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, DecimalInput, FormGroup, Input, ModalFrame, showToast } from '@/components/ui';
import { isIsin, TickerInput } from '@/features/portfolio/components/TickerInput';
import { useBuyStock, useSellStock } from '@/features/portfolio/hooks/useStocks';
import { today } from '@/lib/dateUtils';
import { fmtDec } from '@/lib/format';
import { calculateTotalAmount } from '@/lib/stock.ts';

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
  const { t } = useTranslation('portfolio');
  const { t: tc } = useTranslation('common');
  const { mode, accountId, onClose } = props;
  const position = mode === 'sell' ? (props as SellProps).position : (props as BuyProps).position;

  const buy = useBuyStock(accountId);
  const sell = useSellStock(accountId);
  const mutation = mode === 'buy' ? buy : sell;

  const [ticker, setTicker] = useState(position?.ticker ?? '');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState(position?.current_price ? String(position.current_price) : '');
  const [fees, setFees] = useState('0');
  const [date, setDate] = useState(today);

  const qty = Number.parseFloat(quantity) || 0;
  const pps = Number.parseFloat(price) || 0;
  const f = Number.parseFloat(fees) || 0;
  const amount = calculateTotalAmount(mode, qty, pps, f);

  const isBuy = mode === 'buy';
  const maxQty = isBuy ? undefined : position?.quantity;

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (!ticker.trim() || qty <= 0 || pps <= 0) return;
    const cleanTicker = ticker.trim().toUpperCase();
    mutation.mutate(
      { ticker: cleanTicker, quantity: qty, price_per_share: pps, fees: f, date },
      {
        onSuccess: () => {
          if (isBuy) {
            showToast(t('stock_operation_modal.success_buy', { qty, ticker: cleanTicker }));
          } else {
            showToast(t('stock_operation_modal.success_sell', { qty, ticker: cleanTicker }));
          }
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  const quantityLabel =
    maxQty == null
      ? t('stock_operation_modal.quantity_label')
      : t('stock_operation_modal.quantity_label_max', { max: maxQty });

  let submitLabel: string;
  if (mutation.isPending) {
    submitLabel = tc('loading');
  } else if (isBuy) {
    submitLabel = t('stock_operation_modal.submit_buy');
  } else {
    submitLabel = t('stock_operation_modal.submit_sell');
  }

  return (
    <ModalFrame
      title={isBuy ? t('stock_operation_modal.title_buy') : t('stock_operation_modal.title_sell')}
      onClose={mutation.isPending ? undefined : onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormGroup label={t('stock_operation_modal.ticker_label')} htmlFor="op-ticker">
          <TickerInput
            id="op-ticker"
            value={ticker}
            onChange={setTicker}
            placeholder={t('stock_operation_modal.ticker_placeholder')}
            disabled={!!position}
            autoFocus={!position}
          />
        </FormGroup>

        <div className="flex gap-3">
          <FormGroup label={quantityLabel} htmlFor="op-quantity">
            <Input
              id="op-quantity"
              type="number"
              min="0.001"
              max={maxQty}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={
                isBuy
                  ? t('stock_operation_modal.quantity_placeholder_buy')
                  : t('stock_operation_modal.quantity_placeholder_sell')
              }
              autoFocus={!!position}
            />
          </FormGroup>
          <FormGroup label={t('stock_operation_modal.price_label')} htmlFor="op-price">
            <DecimalInput
              id="op-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={
                isBuy
                  ? t('stock_operation_modal.price_placeholder_buy')
                  : t('stock_operation_modal.price_placeholder_sell')
              }
            />
          </FormGroup>
        </div>

        <div className="flex gap-3">
          <FormGroup label={t('stock_operation_modal.fees_label')} htmlFor="op-fees">
            <DecimalInput
              id="op-fees"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              placeholder={t('stock_operation_modal.fees_placeholder')}
            />
          </FormGroup>
          <FormGroup label={tc('date')} htmlFor="op-date">
            <Input
              id="op-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </FormGroup>
        </div>

        <div className="bg-surface-muted rounded-xl p-3 border border-line">
          <p className="text-[11px] text-content-subtle uppercase tracking-wider mb-1">
            {isBuy
              ? t('stock_operation_modal.total_expense')
              : t('stock_operation_modal.total_received')}
          </p>
          <p className={`font-display text-xl ${amount < 0 ? 'text-danger' : 'text-content'}`}>
            {fmtDec(amount)}
          </p>
        </div>

        <div className="flex gap-2 justify-end mt-1">
          <Button type="button" onClick={onClose} disabled={mutation.isPending}>
            {tc('cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={
              mutation.isPending || !ticker.trim() || isIsin(ticker.trim()) || qty <= 0 || pps <= 0
            }
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}
