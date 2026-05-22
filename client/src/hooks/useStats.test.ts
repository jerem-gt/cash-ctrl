import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createHookWrapper } from '@/tests/helpers/hookWrapper';

import { useProfitability } from './useStats';

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
