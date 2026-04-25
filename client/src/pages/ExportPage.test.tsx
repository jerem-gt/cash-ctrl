import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { ExportPage } from './ExportPage';

describe('ExportPage', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('affiche le titre et la description', () => {
    renderWithProviders(<ExportPage />);
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Téléchargez vos données')).toBeInTheDocument();
  });

  it('affiche les deux boutons de téléchargement', () => {
    renderWithProviders(<ExportPage />);
    expect(screen.getByRole('button', { name: /télécharger csv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /télécharger json/i })).toBeInTheDocument();
  });

  it('déclenche le téléchargement CSV au clic', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportPage />);
    await user.click(screen.getByRole('button', { name: /télécharger csv/i }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it('déclenche le téléchargement JSON au clic', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportPage />);
    await user.click(screen.getByRole('button', { name: /télécharger json/i }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });
});
