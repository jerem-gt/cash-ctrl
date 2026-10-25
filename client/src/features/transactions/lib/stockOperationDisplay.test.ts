import { describe, expect, it } from 'vitest';

import { STOCK_OPERATIONS, STOCK_TX } from '@/tests/fixtures';

import { getStockOperationDisplay } from './stockOperationDisplay';

const withOp = (type: 'buy' | 'sell' | 'transfer_in' | 'transfer_out', quantity = 12) => ({
  ...STOCK_TX,
  stock_operation: { ...STOCK_OPERATIONS[0], type, quantity, ticker: 'CW8.PA' },
});

describe('getStockOperationDisplay', () => {
  it('achat : icône 📈 et clé stock_buy', () => {
    expect(getStockOperationDisplay(withOp('buy'))).toEqual({
      icon: '📈',
      labelKey: 'tx_item.stock_buy',
      quantity: '12',
      ticker: 'CW8.PA',
    });
  });

  it('vente : icône 📉 et clé stock_sell', () => {
    const d = getStockOperationDisplay(withOp('sell', 5));
    expect(d?.icon).toBe('📉');
    expect(d?.labelKey).toBe('tx_item.stock_sell');
  });

  it('formate la quantité sans décimales inutiles', () => {
    expect(getStockOperationDisplay(withOp('buy', 2.5))?.quantity).toBe('2,5');
  });

  it('ignore les transferts de titres', () => {
    expect(getStockOperationDisplay(withOp('transfer_in'))).toBeNull();
    expect(getStockOperationDisplay(withOp('transfer_out'))).toBeNull();
  });

  it('ignore une transaction sans opération, catégorisée ou ventilée', () => {
    expect(getStockOperationDisplay({ ...STOCK_TX, stock_operation: null })).toBeNull();
    expect(getStockOperationDisplay({ ...withOp('buy'), category_id: 2 })).toBeNull();
    expect(getStockOperationDisplay({ ...withOp('buy'), subcategory_id: 3 })).toBeNull();
    expect(
      getStockOperationDisplay({
        ...withOp('buy'),
        splits: [{ id: 1, subcategory_id: 1, amount: 1 }],
      }),
    ).toBeNull();
  });
});
