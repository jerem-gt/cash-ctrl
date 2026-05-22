import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ProfitabilityCard } from '@/components/ProfitabilityCard';
import { PROFITABILITY_DATA } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

const peaData = PROFITABILITY_DATA[0];
const savingsData = PROFITABILITY_DATA[2];
const negativeData = {
  ...peaData,
  plus_value_absolue: -500,
  rendement_total_pct: -5,
  rendement_annualise_pct: -2.5,
};

describe('ProfitabilityCard', () => {
  it('affiche le capital investi et la valeur actuelle', () => {
    renderWithProviders(<ProfitabilityCard data={peaData} />);
    expect(screen.getByText('Capital investi')).toBeInTheDocument();
    expect(screen.getByText('Valeur actuelle')).toBeInTheDocument();
  });

  it('affiche le rendement annualisé', () => {
    renderWithProviders(<ProfitabilityCard data={peaData} />);
    expect(screen.getByText(/10\.67 % \/ an/)).toBeInTheDocument();
  });

  it('affiche — pour le rendement annualisé quand null', () => {
    renderWithProviders(<ProfitabilityCard data={{ ...peaData, rendement_annualise_pct: null }} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('affiche le bouton de détail annuel et le tableau après clic', async () => {
    renderWithProviders(<ProfitabilityCard data={peaData} />);
    expect(screen.queryByText('2022')).toBeNull();
    await userEvent.click(screen.getByText(/Détail par année/));
    expect(screen.getByText('2022')).toBeInTheDocument();
    expect(screen.getByText('2023')).toBeInTheDocument();
    expect(screen.getAllByText('Versements nets')[0]).toBeInTheDocument();
  });

  it('affiche la note estimation pour les comptes épargne', () => {
    renderWithProviders(<ProfitabilityCard data={savingsData} />);
    expect(screen.getByText(/Estimation/)).toBeInTheDocument();
  });

  it("n'affiche pas la note estimation pour les comptes non-épargne", () => {
    renderWithProviders(<ProfitabilityCard data={peaData} />);
    expect(screen.queryByText(/Estimation/)).toBeNull();
  });

  it('affiche la couleur rouge pour une plus-value négative', () => {
    renderWithProviders(<ProfitabilityCard data={negativeData} />);
    const plusValueCell = screen.getByText(/-500/);
    expect(plusValueCell.closest('div')).toHaveClass('text-red-600');
  });
});
