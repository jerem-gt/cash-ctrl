import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { useDashboardData } from '@/features/dashboard/hooks/useDashboardData';
import { createHookWrapper } from '@/tests/helpers/hookWrapper';
import { server } from '@/tests/msw/server';

const STATS = {
  month_income: 3000,
  month_expense: 1200,
  monthly: [
    { income: 2500, expense: 1000 },
    { income: 3000, expense: 1200 },
  ],
  expenses_by_category: [
    { category: 'Alimentation', amount: 500 },
    { category: 'Transport', amount: 700 },
  ],
  recent: [],
  to_validate: [],
  upcoming: [],
};

describe('useDashboardData', () => {
  it('isLoading démarre à true puis passe à false', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDashboardData(), { wrapper: Wrapper });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('calcule bilan = monthIncome - monthExpense', async () => {
    server.use(http.get('/api/stats', () => HttpResponse.json(STATS)));
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDashboardData(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.monthIncome).toBe(3000);
    expect(result.current.monthExpense).toBe(1200);
    expect(result.current.bilan).toBe(1800);
  });

  it('construit catData depuis expenses_by_category', async () => {
    server.use(http.get('/api/stats', () => HttpResponse.json(STATS)));
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDashboardData(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.catData).toHaveLength(2);
    expect(result.current.catData[0]).toMatchObject({ name: 'Alimentation', value: 500 });
    expect(result.current.catData[1]).toMatchObject({ name: 'Transport', value: 700 });
  });

  it('construit barData depuis monthly avec des libellés de mois', async () => {
    server.use(http.get('/api/stats', () => HttpResponse.json(STATS)));
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDashboardData(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.barData).toHaveLength(2);
    expect(result.current.barData[0]).toMatchObject({ Revenus: 2500, Depenses: 1000 });
    expect(typeof result.current.barData[0].month).toBe('string');
    expect(result.current.barData[0].month.length).toBeGreaterThan(0);
  });

  it('hasReimbursements est true si des remboursements sont en attente', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDashboardData(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasReimbursements).toBe(true);
  });

  it('hasReimbursements est false si pending et recent sont vides', async () => {
    server.use(
      http.get('/api/reimbursements/pending', () => HttpResponse.json([])),
      http.get('/api/reimbursements/recent', () => HttpResponse.json([])),
    );
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDashboardData(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasReimbursements).toBe(false);
  });

  it('expose les comptes et la logoMap', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useDashboardData(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.accounts.length).toBeGreaterThan(0);
    expect(result.current.logoMap).toBeDefined();
  });
});
