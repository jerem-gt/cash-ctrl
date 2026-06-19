import type { BalanceHistoryData } from '@cashctrl/types';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { WealthCard } from '@/features/dashboard/components/WealthCard';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

const history: BalanceHistoryData = {
  account_types: ['liquidites', 'epargne'],
  data: [
    { year: '2024', liquidites: 1000, epargne: 500 },
    { year: '2025', liquidites: 1200, epargne: 800 },
  ],
};

describe('WealthCard', () => {
  it('affiche le titre et les deux boutons de vue', () => {
    renderWithProviders(<WealthCard history={history} />);
    expect(screen.getByText('Mon patrimoine')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solde net' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Répartition' })).toBeInTheDocument();
  });

  it('démarre sur la vue "Répartition" par défaut', () => {
    renderWithProviders(<WealthCard history={history} />);
    const breakdownBtn = screen.getByRole('button', { name: 'Répartition' });
    expect(breakdownBtn.className).toMatch(/font-medium/);
  });

  it('affiche la légende en vue "Répartition" (par défaut)', () => {
    renderWithProviders(<WealthCard history={history} />);
    expect(screen.getByText('Liquidités')).toBeInTheDocument();
    expect(screen.getByText('Épargne')).toBeInTheDocument();
  });

  it('bascule sur la vue "Solde net" et masque la légende', async () => {
    renderWithProviders(<WealthCard history={history} />);
    expect(screen.getByText('Liquidités')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Solde net' }));
    expect(screen.queryByText('Liquidités')).toBeNull();
  });

  it('monte sans planter avec un historique vide', () => {
    const empty: BalanceHistoryData = { account_types: [], data: [] };
    const { container } = renderWithProviders(<WealthCard history={empty} />);
    expect(container).toBeInTheDocument();
  });

  it('monte sans planter avec des prêts (total négatif)', () => {
    const withLoans: BalanceHistoryData = {
      account_types: ['liquidites', 'prets'],
      data: [{ year: '2025', liquidites: 500, prets: -800 }],
    };
    const { container } = renderWithProviders(<WealthCard history={withLoans} />);
    expect(container).toBeInTheDocument();
  });

  it("n'affiche pas les boutons de pagination quand ≤ 10 années", () => {
    renderWithProviders(<WealthCard history={history} />);
    expect(screen.queryByLabelText('Années précédentes')).toBeNull();
    expect(screen.queryByLabelText('Années suivantes')).toBeNull();
  });

  it('affiche les boutons de pagination quand > 10 années', () => {
    const longHistory: BalanceHistoryData = {
      account_types: ['liquidites'],
      data: Array.from({ length: 12 }, (_, i) => ({ year: String(2014 + i), liquidites: 1000 })),
    };
    renderWithProviders(<WealthCard history={longHistory} />);
    expect(screen.getByLabelText('Années précédentes')).toBeInTheDocument();
    expect(screen.getByLabelText('Années suivantes')).toBeInTheDocument();
  });

  it('navigue vers les années précédentes puis revient', async () => {
    const longHistory: BalanceHistoryData = {
      account_types: ['liquidites'],
      data: Array.from({ length: 12 }, (_, i) => ({ year: String(2014 + i), liquidites: 1000 })),
    };
    renderWithProviders(<WealthCard history={longHistory} />);

    const prevBtn = screen.getByLabelText('Années précédentes');
    const nextBtn = screen.getByLabelText('Années suivantes');

    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();

    await userEvent.click(prevBtn);
    expect(nextBtn).not.toBeDisabled();
    expect(prevBtn).toBeDisabled();

    await userEvent.click(nextBtn);
    expect(nextBtn).toBeDisabled();
  });
});
