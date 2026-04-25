import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { AccountsPage } from './AccountsPage';

describe('AccountsPage', () => {
  it('affiche le titre et le bouton de création', () => {
    renderWithProviders(<AccountsPage />);
    expect(screen.getByText('Comptes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nouveau compte/i })).toBeInTheDocument();
  });

  it("affiche l'état vide quand aucun compte", async () => {
    server.use(http.get('/api/accounts', () => HttpResponse.json([])));
    renderWithProviders(<AccountsPage />);
    expect(await screen.findByText("Aucun compte pour l'instant.")).toBeInTheDocument();
  });

  it('affiche les comptes groupés par type après le chargement', async () => {
    renderWithProviders(<AccountsPage />);
    await screen.findByText('Compte courant');
    expect(screen.getByText('Courant')).toBeInTheDocument(); // CSS uppercase, DOM text reste "Courant"
    expect(screen.getByText('Compte courant')).toBeInTheDocument();
  });

  it('affiche le solde du compte', async () => {
    renderWithProviders(<AccountsPage />);
    await screen.findByText('Compte courant');
    // Balance 1500 formatted
    expect(screen.getAllByText(/1.500/)[0]).toBeInTheDocument();
  });

  it('ouvre le modal de création au clic', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountsPage />);
    await screen.findByText('Compte courant');
    await user.click(screen.getByRole('button', { name: /nouveau compte/i }));
    expect(screen.getByText('Nouveau compte')).toBeInTheDocument();
  });
});
