import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ExportManager from '@/features/settings/components/ExportManager.tsx';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';

describe('ExportManager', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('affiche uniquement le bouton Exporter en état initial', () => {
    renderWithProviders(<ExportManager />);
    expect(screen.getByRole('button', { name: /exporter/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /télécharger/i })).not.toBeInTheDocument();
  });

  it('ouvre le panneau avec tous les comptes cochés', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportManager />);
    await user.click(screen.getByRole('button', { name: /exporter/i }));
    expect(await screen.findByText('Compte test')).toBeInTheDocument();
    expect(screen.getByText('Livret A')).toBeInTheDocument();
    screen.getAllByRole('checkbox').forEach((cb) => expect(cb).toBeChecked());
  });

  it('ferme le panneau en cliquant sur Fermer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportManager />);
    await user.click(screen.getByRole('button', { name: /exporter/i }));
    await screen.findByRole('button', { name: /fermer/i });
    await user.click(screen.getByRole('button', { name: /fermer/i }));
    expect(screen.queryByRole('button', { name: /télécharger/i })).not.toBeInTheDocument();
  });

  it('déclenche le téléchargement avec les comptes sélectionnés', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportManager />);
    await user.click(screen.getByRole('button', { name: /exporter/i }));
    await screen.findByText('Compte test');
    await user.click(screen.getByRole('button', { name: /télécharger/i }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it('désélectionner un compte réduit le compteur', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExportManager />);
    await user.click(screen.getByRole('button', { name: /exporter/i }));
    const compteTest = await screen.findByRole('checkbox', { name: /compte test/i });
    await user.click(compteTest);
    expect(compteTest).not.toBeChecked();
    expect(screen.getByRole('button', { name: /télécharger \(2\)/i })).toBeInTheDocument();
  });
});
