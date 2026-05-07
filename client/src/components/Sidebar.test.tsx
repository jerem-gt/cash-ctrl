import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it("affiche le nom de l'application", () => {
    renderWithProviders(<Sidebar username="usertest" />);
    expect(screen.getAllByText(/cashctrl/i).length).toBeGreaterThan(0);
  });

  it('affiche les liens de navigation principaux', () => {
    renderWithProviders(<Sidebar username="usertest" />);
    expect(screen.getByText('Comptes')).toBeInTheDocument();
  });

  it('affiche le bouton paramètres', async () => {
    renderWithProviders(<Sidebar username="usertest" />);
    expect(screen.getByText('⚙')).toBeInTheDocument();
    expect(await screen.findByTitle(/Menu/i)).toBeInTheDocument();
  });

  it("affiche le nom d'utilisateur", () => {
    renderWithProviders(<Sidebar username="jerem" />);
    expect(screen.getByText('jerem')).toBeInTheDocument();
  });

  it('affiche le bouton Déconnexion', async () => {
    renderWithProviders(<Sidebar username="usertest" />);
    expect(await screen.findByTitle(/Déconnexion/i)).toBeInTheDocument();
  });

  it('affiche le compte chargé dans la liste', async () => {
    renderWithProviders(<Sidebar username="usertest" />);
    expect(await screen.findByText('Compte test')).toBeInTheDocument();
  });

  it('bascule le groupement au clic sur le bouton', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Sidebar username="usertest" />);
    await screen.findByText('Compte test');
    const groupBtn = screen.getByRole('button', { name: 'Banque' });
    await user.click(groupBtn);
    expect(groupBtn).toBeInTheDocument();
  });
});
