import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { UserMenu } from './UserMenu';

describe('UserMenu', () => {
  const defaultProps = {
    username: 'admin',
    onLogout: vi.fn(),
  };

  it('affiche le nom de l’utilisateur et l’initiale dans l’avatar', () => {
    renderWithProviders(<UserMenu {...defaultProps} />);

    // Vérifie le nom
    expect(screen.getByText('admin')).toBeInTheDocument();
    // Vérifie l'initiale dans l'avatar
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('ouvre le menu au clic sur le bouton principal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserMenu {...defaultProps} />);

    // Le menu ne doit pas être visible au départ
    expect(screen.queryByText('Sécurité')).not.toBeInTheDocument();

    // Clic pour ouvrir
    await user.click(screen.getByLabelText(/menu utilisateur/i));

    // Vérifie que les items du menu sont là
    expect(screen.getByText('Sécurité')).toBeInTheDocument();
    expect(screen.getByText('Déconnexion')).toBeInTheDocument();
  });

  it('appelle onLogout et ferme le menu lors du clic sur déconnexion', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserMenu {...defaultProps} />);

    // Ouvrir le menu
    await user.click(screen.getByLabelText(/menu utilisateur/i));

    // Cliquer sur déconnexion
    const logoutBtn = screen.getByRole('button', { name: /déconnexion/i });
    await user.click(logoutBtn);

    // Vérifie que la callback est appelée
    expect(defaultProps.onLogout).toHaveBeenCalledTimes(1);

    // Vérifie que le menu se ferme
    expect(screen.queryByText('Sécurité')).not.toBeInTheDocument();
  });

  it('ferme le menu lors du clic sur un lien de navigation (Sécurité)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserMenu {...defaultProps} />);

    await user.click(screen.getByLabelText(/menu utilisateur/i));

    const securityLink = screen.getByText('Sécurité');
    await user.click(securityLink);

    // Le menu doit se fermer après la navigation
    expect(screen.queryByText('Sécurité')).not.toBeInTheDocument();
  });

  it('ferme le menu lors d’un clic à l’extérieur', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <div>
        <div data-testid="outside">Extérieur</div>
        <UserMenu {...defaultProps} />
      </div>,
    );

    // Ouvrir
    await user.click(screen.getByLabelText(/menu utilisateur/i));
    expect(screen.getByText('Sécurité')).toBeInTheDocument();

    // Cliquer à l'extérieur
    await user.click(screen.getByTestId('outside'));

    // Vérifier la fermeture
    await waitFor(() => {
      expect(screen.queryByText('Sécurité')).not.toBeInTheDocument();
    });
  });

  it('applique la classe active au bouton quand le menu est ouvert', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserMenu {...defaultProps} />);

    const trigger = screen.getByLabelText(/menu utilisateur/i);

    await user.click(trigger);
    expect(trigger).toHaveClass('bg-white/10');

    await user.click(trigger);
    expect(trigger).not.toHaveClass('bg-white/10');
  });
});
