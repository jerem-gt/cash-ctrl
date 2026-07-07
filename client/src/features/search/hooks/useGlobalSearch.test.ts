import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SEARCH_RESPONSE } from '@/tests/fixtures';
import { createHookWrapper } from '@/tests/helpers/hookWrapper';

import { useGlobalSearch } from './useGlobalSearch';

describe('useGlobalSearch', () => {
  it('charge les résultats et convertit les montants (centimes -> euros)', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useGlobalSearch('café'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.accounts).toHaveLength(1);
    expect(result.current.data?.transactions[0].amount).toBe(
      SEARCH_RESPONSE.transactions[0].amount / 100,
    );
    expect(result.current.data?.scheduled[0].amount).toBe(
      SEARCH_RESPONSE.scheduled[0].amount / 100,
    );
    expect(result.current.data?.stocks).toHaveLength(1);
  });

  it('reste désactivé (pas de requête) tant que la recherche fait moins de 2 caractères', () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useGlobalSearch('c'), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });
});
