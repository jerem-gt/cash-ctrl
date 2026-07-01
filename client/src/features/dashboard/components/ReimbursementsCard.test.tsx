import type { PendingReimbursement } from '@cashctrl/types';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { loadI18nForTests } from '@/tests/helpers/i18nTestUtils';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

const makePR = (id: number, description: string): PendingReimbursement => ({
  id,
  amount: 100,
  description,
  date: '2026-01-01',
  subcategory: 'Test',
  category: 'Test',
  account_name: 'Compte test',
  total_reimbursed: 0,
});

const FIVE = Array.from({ length: 5 }, (_, i) => makePR(i + 1, `Item ${i + 1}`));
const SIX = Array.from({ length: 6 }, (_, i) => makePR(i + 1, `Item ${i + 1}`));

let ReimbursementsCard: typeof import('./ReimbursementsCard').ReimbursementsCard;

beforeAll(async () => {
  vi.doMock('@/features/transactions/hooks/useReimbursements', () => ({
    // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix
    useSetReimbursementStatus: () => ({ mutate: vi.fn(), isPending: false }),
  }));
  vi.resetModules();
  ({ ReimbursementsCard } = await import('./ReimbursementsCard'));
  await loadI18nForTests();
});

afterAll(() => {
  vi.doUnmock('@/features/transactions/hooks/useReimbursements');
  vi.resetModules();
});

describe('ReimbursementsCard', () => {
  it('affiche les items en attente et récents', () => {
    renderWithProviders(
      <ReimbursementsCard pending={[makePR(1, 'Médecin')]} recent={[makePR(2, 'Pharmacie')]} />,
    );
    expect(screen.getByText('Médecin')).toBeInTheDocument();
    expect(screen.getByText('Pharmacie')).toBeInTheDocument();
  });

  it("n'affiche pas la pagination quand ≤ 5 items par section", () => {
    renderWithProviders(<ReimbursementsCard pending={FIVE} recent={FIVE} />);
    expect(screen.queryByLabelText('Page suivante')).toBeNull();
    expect(screen.queryByLabelText('Page précédente')).toBeNull();
  });

  it('affiche la pagination dans la section en attente quand > 5 items', () => {
    renderWithProviders(<ReimbursementsCard pending={SIX} recent={[]} />);
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByLabelText('Page suivante')).toBeInTheDocument();
    expect(screen.getByLabelText('Page précédente')).toBeInTheDocument();
  });

  it('affiche les 5 premiers items en attente sur la page 1', () => {
    renderWithProviders(<ReimbursementsCard pending={SIX} recent={[]} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 5')).toBeInTheDocument();
    expect(screen.queryByText('Item 6')).toBeNull();
  });

  it('navigue à la page suivante puis revient en arrière', async () => {
    renderWithProviders(<ReimbursementsCard pending={SIX} recent={[]} />);
    const next = screen.getByLabelText('Page suivante');
    const prev = screen.getByLabelText('Page précédente');

    expect(prev).toBeDisabled();
    expect(next).not.toBeDisabled();

    await userEvent.click(next);
    expect(screen.getByText('Item 6')).toBeInTheDocument();
    expect(screen.queryByText('Item 1')).toBeNull();
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(next).toBeDisabled();

    await userEvent.click(prev);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('pagine les sections pending et recent indépendamment', () => {
    renderWithProviders(<ReimbursementsCard pending={SIX} recent={SIX} />);
    const indicators = screen.getAllByText('1/2');
    expect(indicators).toHaveLength(2);
  });
});
