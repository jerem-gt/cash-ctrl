import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { FORECAST_RESPONSE } from '@/tests/fixtures';
import { createHookWrapper } from '@/tests/helpers/hookWrapper';
import { server } from '@/tests/msw/server';

import { useForecast } from './useForecast';

describe('useForecast', () => {
  it('charge le forecast et convertit les montants (centimes -> euros)', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useForecast(90), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.horizon).toBe(90);
    expect(result.current.data?.accounts).toHaveLength(2);

    const acc1 = result.current.data?.accounts.find((a) => a.account_id === 1);
    expect(acc1?.current_balance).toBe(1500);
    expect(acc1?.goes_negative_on).toBe('2026-08-15');
    expect(acc1?.points.find((p) => p.date === '2026-08-15')?.balance).toBe(-200);

    const acc2 = result.current.data?.accounts.find((a) => a.account_id === 2);
    expect(acc2?.current_balance).toBe(500);
    expect(acc2?.goes_negative_on).toBeNull();
  });

  it("transmet l'horizon demandé dans la requête", async () => {
    let capturedUrl = '';
    server.use(
      http.get('/api/stats/forecast', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(FORECAST_RESPONSE);
      }),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useForecast(30), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain('horizon=30');
  });

  it('transmet account_id dans la requête quand fourni', async () => {
    let capturedUrl = '';
    server.use(
      http.get('/api/stats/forecast', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          horizon: 90,
          accounts: FORECAST_RESPONSE.accounts.filter((a) => a.account_id === 1),
        });
      }),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useForecast(90, 1), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain('account_id=1');
    expect(result.current.data?.accounts).toHaveLength(1);
  });
});
