import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createHookWrapper } from '@/tests/helpers/hookWrapper';

import { useAccountBalanceHistory, useProfitability } from './useStats';

describe('useProfitability', () => {
  it('charge les données de rentabilité', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useProfitability(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(3);
    expect(result.current.data![0].account_name).toBe('PEA');
    expect(result.current.data![0].rendement_total_pct).toBe(35);
  });
});

describe('useAccountBalanceHistory', () => {
  it("charge l'historique de solde et convertit les montants (centimes -> euros)", async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useAccountBalanceHistory(1, 90), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.account_id).toBe(1);
    expect(result.current.data?.days).toBe(90);
    expect(result.current.data?.points.find((p) => p.date === '2026-07-07')?.balance).toBe(1500);
  });
});
