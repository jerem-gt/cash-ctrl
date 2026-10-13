import type { QueryClient } from '@tanstack/react-query';

import { fireAndForget } from '@/lib/async';
import { queryKeys } from '@/lib/queryKeys';

function invalidateAll(qc: QueryClient, keys: readonly (readonly unknown[])[]) {
  for (const queryKey of keys) fireAndForget(qc.invalidateQueries({ queryKey }));
}

// Tout ce qui dépend des soldes de comptes.
export function invalidateBalances(qc: QueryClient) {
  invalidateAll(qc, [
    queryKeys.accounts(),
    queryKeys.dashboardStats(),
    queryKeys.forecastAll(),
    queryKeys.accountBalanceHistoryAll(),
    queryKeys.balanceHistory(),
    queryKeys.profitability(),
  ]);
}

export function invalidateTransactions(qc: QueryClient) {
  invalidateAll(qc, [queryKeys.transactions.all()]);
}

// Positions et opérations de bourse, tous comptes confondus.
export function invalidatePortfolio(qc: QueryClient) {
  invalidateAll(qc, [queryKeys.stocks.positions.all(), queryKeys.stocks.operationsAll()]);
}
