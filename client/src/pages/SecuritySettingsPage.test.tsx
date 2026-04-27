import { screen } from '@testing-library/react';

import { SecuritySettingsPage } from '@/pages/SecuritySettingsPage.tsx';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';

describe('SettingsPage', () => {
  it('affiche le titre et les sections', async () => {
    renderWithProviders(<SecuritySettingsPage />);
    expect(screen.getByText('Sécurité')).toBeInTheDocument();
    await screen.findByText('Changer le mot de passe');
  });
});
