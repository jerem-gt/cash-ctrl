import type { Transaction } from '@cashctrl/types';

import { currentLocale } from '@/lib/format';

export interface StockOperationDisplay {
  icon: string;
  labelKey: 'tx_item.stock_buy' | 'tx_item.stock_sell';
  quantity: string;
  ticker: string;
}

// Achat/vente de titres sans catégorie ni ventilation : icône et sous-titre dédiés.
export function getStockOperationDisplay(
  tx: Pick<Transaction, 'stock_operation' | 'category_id' | 'subcategory_id' | 'splits'>,
): StockOperationDisplay | null {
  const op = tx.stock_operation;
  if (!op || tx.category_id || tx.subcategory_id || tx.splits?.length) return null;
  if (op.type !== 'buy' && op.type !== 'sell') return null;
  const isBuy = op.type === 'buy';
  return {
    icon: isBuy ? '📈' : '📉',
    labelKey: isBuy ? 'tx_item.stock_buy' : 'tx_item.stock_sell',
    quantity: new Intl.NumberFormat(currentLocale(), { maximumFractionDigits: 6 }).format(
      op.quantity,
    ),
    ticker: op.ticker,
  };
}
