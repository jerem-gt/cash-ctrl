import { screen } from '@testing-library/react';

import { SettingsManager } from '@/features/settings';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';

describe('SettingsManager', () => {
  it('affiche les sections', async () => {
    renderWithProviders(<SettingsManager activeTab="categories" onChange={() => {}} />);
    expect(await screen.findByText('Banques')).toBeInTheDocument();
    expect(await screen.findByText('Types de compte')).toBeInTheDocument();
    expect(await screen.findByText('Moyens de paiement')).toBeInTheDocument();
    expect(await screen.findByText('Catégories')).toBeInTheDocument();
  });
});
