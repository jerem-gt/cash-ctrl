import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SettingsPage from '@/pages/SettingsPage.tsx';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';

describe('SettingsPage', () => {
  it('affiche le titre et les sections', async () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getAllByText('Paramètres').length).toBeGreaterThan(0);
    await screen.findByText('Banques');
    expect(screen.getByText('Types de compte')).toBeInTheDocument();
    expect(screen.getByText('Moyens de paiement')).toBeInTheDocument();
    expect(screen.getByText('Catégories')).toBeInTheDocument();
    expect(screen.getByText('Backup')).toBeInTheDocument();
  });

  it('réunit le profil et le mot de passe dans une seule rubrique', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    expect(screen.queryByRole('button', { name: 'Mot de passe' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Profil et mot de passe' }));

    expect(await screen.findByText('Profil')).toBeInTheDocument();
    expect(screen.getByText('Changer le mot de passe')).toBeInTheDocument();
  });
});
