import { screen } from '@testing-library/react';

import SettingsPage from '@/pages/SettingsPage.tsx';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';

describe('SettingsPage', () => {
  it('affiche le titre et les sections', async () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('Paramètres')).toBeInTheDocument();
    await screen.findByText('Banques');
    expect(screen.getByText('Types de compte')).toBeInTheDocument();
    expect(screen.getByText('Moyens de paiement')).toBeInTheDocument();
    expect(screen.getByText('Catégories')).toBeInTheDocument();
    expect(screen.getByText('Changement de mot de passe')).toBeInTheDocument();
  });
});
