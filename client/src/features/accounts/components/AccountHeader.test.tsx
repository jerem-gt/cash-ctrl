import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AccountHeader } from '@/features/accounts/components/AccountHeader';
import { ACCOUNTS } from '@/tests/fixtures.ts';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';

const logoMap: Record<string, string | null> = { BNP: 'fakePath' };
const props = {
  account: ACCOUNTS[0],
  logoMap: logoMap,
  bankLoginUrl: null,
  isInvestment: false,
  isInsurance: false,
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

  it('affiche le nom de banque en lien cliquable quand bankLoginUrl est défini', async () => {
    renderWithProviders(
      <AccountHeader {...props} bankLoginUrl="https://mabanque.bnpparibas.com/fr/connexion" />,
    );
    await screen.findByText('Compte test');
    const link = screen.getByRole('link', { name: /BNP/i });
    expect(link).toHaveAttribute('href', 'https://mabanque.bnpparibas.com/fr/connexion');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('affiche le nom de banque en texte simple quand bankLoginUrl est null', async () => {
    renderWithProviders(<AccountHeader {...props} bankLoginUrl={null} />);
    await screen.findByText('Compte test');
    expect(screen.queryByRole('link', { name: /BNP/i })).not.toBeInTheDocument();
    expect(screen.getByText('BNP')).toBeInTheDocument();
  });

  it("cache le logo du compte si l'image est corrompue", async () => {
    renderWithProviders(<AccountHeader {...props} />);
    const img = await screen.findByRole('img', { name: /logo BNP/i });

    // Déclencher manuellement l'erreur
    fireEvent.error(img);

    expect(img).toHaveStyle({ display: 'none' });
  });
});
