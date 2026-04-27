import { screen } from '@testing-library/react';

import { SettingsTabs } from '@/features/settings';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';

describe('SettingsTabs', () => {
  it('affiche les sections', async () => {
    renderWithProviders(<SettingsTabs activeTab="categories" onChange={() => {}} />);
    expect(await screen.findByText('Banques')).toBeInTheDocument();
    expect(await screen.findByText('Banques')).toBeInTheDocument();
    expect(await screen.findByText('Types de compte')).toBeInTheDocument();
    expect(await screen.findByText('Moyens de paiement')).toBeInTheDocument();
    expect(await screen.findByText('Catégories')).toBeInTheDocument();
    expect(await screen.findByText('Changement de mot de passe')).toBeInTheDocument();
  });
});
