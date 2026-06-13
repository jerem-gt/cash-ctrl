import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { useReport, useReportYears } from '@/hooks/useReport';
import { REPORT_DATA, REPORT_YEARS } from '@/tests/fixtures';
import { createHookWrapper } from '@/tests/helpers/hookWrapper';
import { server } from '@/tests/msw/server';

describe('useReportYears', () => {
  it('retourne les années disponibles', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useReportYears(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(REPORT_YEARS);
  });
});

describe('useReport', () => {
  it('retourne les données du rapport pour une année', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useReport(2026), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.income_total).toBe(REPORT_DATA.income_total);
    expect(result.current.data?.expense_total).toBe(REPORT_DATA.expense_total);
    expect(result.current.data?.monthly).toHaveLength(12);
    expect(result.current.data?.expense_by_category).toHaveLength(2);
    expect(result.current.data?.income_by_category).toHaveLength(1);
  });

  it('transmet account_id dans la requête', async () => {
    let capturedUrl = '';
    server.use(
      http.get('/api/stats/report', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(REPORT_DATA);
      }),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useReport(2026, 1), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(capturedUrl).toContain('account_id=1');
  });

  it('isLoading démarre à true puis passe à false', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useReport(2026), { wrapper: Wrapper });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
