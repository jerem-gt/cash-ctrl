import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it("affiche le nom de l'application", () => {
    renderWithProviders(<Sidebar username="test" />);
    expect(screen.getAllByText(/cashctrl/i).length).toBeGreaterThan(0);
  });

  it('affiche les liens de navigation principaux', () => {
    renderWithProviders(<Sidebar username="test" />);
    expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Planifiées')).toBeInTheDocument();
  });

  it('affiche les liens de navigation bas de page', () => {
    renderWithProviders(<Sidebar username="test" />);
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Paramètres')).toBeInTheDocument();
  });

  it("affiche le nom d'utilisateur", () => {
    renderWithProviders(<Sidebar username="jerem" />);
    expect(screen.getByText('jerem')).toBeInTheDocument();
  });

  it('affiche le bouton de déconnexion', () => {
    renderWithProviders(<Sidebar username="test" />);
    expect(screen.getByRole('button', { name: /déconnexion/i })).toBeInTheDocument();
  });

  it('affiche le compte chargé dans la liste', async () => {
    renderWithProviders(<Sidebar username="test" />);
    await screen.findByText('Compte courant');
  });

  it('bascule le groupement au clic sur le bouton', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Sidebar username="test" />);
    await screen.findByText('Compte courant');
    const groupBtn = screen.getByRole('button', { name: 'Banque' });
    await user.click(groupBtn);
    expect(groupBtn).toBeInTheDocument();
  });
});
