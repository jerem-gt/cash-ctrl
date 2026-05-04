import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AccountHeader } from '@/components/AccountHeader.tsx';
import { ACCOUNTS } from '@/tests/fixtures.ts';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';

const logoMap: Record<string, string | null> = { BNP: 'fakePath' };
const props = {
  account: ACCOUNTS[0],
  logoMap: logoMap,
  isInvestment: false,
  isLoan: false,
  capitalRestantDu: 0,
};

describe('AccountHeader', () => {
  it('affiche le nom du compte après chargement', async () => {
    renderWithProviders(<AccountHeader {...props} />);
    await screen.findByText('Compte test');
    expect(screen.getByText('Compte test')).toBeInTheDocument();
  });

  it('affiche le solde du compte', async () => {
    renderWithProviders(<AccountHeader {...props} />);
    await screen.findByText('Compte test');
    expect(screen.getByText(/1.500/)).toBeInTheDocument();
  });

  it('calcule l’ancienneté du compte', async () => {
    vi.setSystemTime(new Date('2026-04-01'));
    renderWithProviders(<AccountHeader {...props} />);
    // Vérifie que le texte généré par accountSeniority est présent
    expect(await screen.findByText(/2 ans 3 mois/i)).toBeInTheDocument();
  });

  it("cache le logo du compte si l'image est corrompue", async () => {
    renderWithProviders(<AccountHeader {...props} />);
    const img = await screen.findByRole('img', { name: /logo BNP/i });

    // Déclencher manuellement l'erreur
    fireEvent.error(img);

    expect(img).toHaveStyle({ display: 'none' });
  });
});
