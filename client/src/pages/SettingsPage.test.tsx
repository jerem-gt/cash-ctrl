import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { SettingsPage } from './SettingsPage';

describe('SettingsPage', () => {
  it('affiche le titre et les sections', async () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('Paramètres')).toBeInTheDocument();
    // CardTitle rend le texte en mixed case ; CSS uppercase est visuel uniquement
    await screen.findByText('Banques');
    expect(screen.getByText('Types de compte')).toBeInTheDocument();
    expect(screen.getByText('Moyens de paiement')).toBeInTheDocument();
    expect(screen.getByText('Catégories')).toBeInTheDocument();
    expect(screen.getByText('Changer le mot de passe')).toBeInTheDocument();
  });

  it('affiche les banques chargées', async () => {
    renderWithProviders(<SettingsPage />);
    await screen.findByText('BNP');
  });

  it('affiche les catégories chargées', async () => {
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Alimentation');
  });

  it('affiche les moyens de paiement chargés', async () => {
    renderWithProviders(<SettingsPage />);
    await screen.findByText('CB');
  });

  it('affiche une erreur toast si les mots de passe ne correspondent pas', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    const passwordInputs = document.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0], 'oldpass');
    await user.type(passwordInputs[1], 'newpass1');
    await user.type(passwordInputs[2], 'different');

    await user.click(screen.getByRole('button', { name: /mettre à jour/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('ne correspondent pas'),
    );
  });

  it('affiche une erreur toast si le nouveau mot de passe est trop court', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    const passwordInputs = document.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0], 'oldpass');
    await user.type(passwordInputs[1], 'court');
    await user.type(passwordInputs[2], 'court');

    await user.click(screen.getByRole('button', { name: /mettre à jour/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('8 caractères'),
    );
  });
});
