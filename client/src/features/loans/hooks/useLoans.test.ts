import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { LOAN, LOAN_INSTALLMENTS } from '@/tests/fixtures';
import { createHookWrapper } from '@/tests/helpers/hookWrapper';
import { server } from '@/tests/msw/server';

import {
  useCreateLoan,
  useLoan,
  useLoanInstallments,
  useUpdateInstallment,
  useUpdateLoan,
} from './useLoans';

describe('useLoan', () => {
  it('récupère le prêt par id de compte', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useLoan(10), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.principal_amount).toBe(LOAN.principal_amount);
    expect(result.current.data?.id).toBe(LOAN.id);
  });

  it("n'exécute pas la requête si accountId vaut 0", () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useLoan(0), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useLoanInstallments', () => {
  it('récupère les mensualités par id de prêt', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useLoanInstallments(1), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(LOAN_INSTALLMENTS.length);
    expect(result.current.data![0].installment_number).toBe(1);
  });

  it("n'exécute pas la requête si loanId est undefined", () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useLoanInstallments(undefined), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateLoan', () => {
  it('crée un prêt avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCreateLoan(), { wrapper: Wrapper });

    result.current.mutate({
      name: 'Nouveau prêt',
      bank_id: 1,
      opening_date: '2024-01-01',
      principal_amount: 12000,
      interest_rate: 0.05,
      duration_months: 36,
      start_date: '2024-02-01',
      source_account_id: 1,
      deposit_account_id: 2,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(LOAN.id);
  });

  it("retourne une erreur si l'API échoue", async () => {
    server.use(
      http.post('/api/loans', () =>
        HttpResponse.json({ error: 'Type de compte introuvable' }, { status: 400 }),
      ),
    );

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useCreateLoan(), { wrapper: Wrapper });

    result.current.mutate({
      name: 'Prêt',
      bank_id: null,
      opening_date: '2024-01-01',
      principal_amount: 1000,
      interest_rate: 0.05,
      duration_months: 12,
      start_date: '2024-02-01',
      source_account_id: 1,
      deposit_account_id: 2,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('introuvable');
  });
});

describe('useUpdateLoan', () => {
  it('met à jour un prêt avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useUpdateLoan(1), { wrapper: Wrapper });

    result.current.mutate({
      name: 'Prêt modifié',
      bank_id: null,
      opening_date: '2024-06-01',
      source_account_id: 1,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(LOAN.id);
  });
});

describe('useUpdateInstallment', () => {
  it('met à jour une mensualité avec succès', async () => {
    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useUpdateInstallment(1), { wrapper: Wrapper });

    result.current.mutate({
      installmentId: 101,
      due_date: '2024-03-15',
      total_amount: 400,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(LOAN_INSTALLMENTS[0].id);
  });
});
