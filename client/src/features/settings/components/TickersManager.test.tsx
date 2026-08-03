import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';

import { TickersManager } from './TickersManager';

describe('TickersManager', () => {
  it('affiche les tickers avec leur statut in_use', async () => {
    renderWithProviders(<TickersManager />);
    expect(await screen.findByText('DCAM.PA')).toBeInTheDocument();
    expect(screen.getByText('ORPHAN.PA')).toBeInTheDocument();
    expect(screen.getByText("en cours d'utilisation")).toBeInTheDocument();
    expect(screen.getByText('Tickers actions')).toBeInTheDocument();
  });

  it('supprime un ticker inutilisé après confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TickersManager />);
    await screen.findByText('DCAM.PA');
    await user.click(screen.getByLabelText('Supprimer DCAM.PA'));
    await user.click(screen.getByRole('button', { name: /confirmer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('supprimée'),
    );
  });

  it("n'affiche pas de bouton supprimer pour un ticker en cours d'utilisation", async () => {
    renderWithProviders(<TickersManager />);
    await screen.findByText('AIR.PA');
    expect(screen.queryByLabelText('Supprimer AIR.PA')).not.toBeInTheDocument();
  });

  it('affiche un tooltip expliquant où le ticker est utilisé', async () => {
    renderWithProviders(<TickersManager />);
    await screen.findByText('AIR.PA');
    const badge = screen.getByText("en cours d'utilisation");
    expect(badge.getAttribute('title')).toContain('PEA Test');
    expect(badge.getAttribute('title')).toContain('Utilisé par un autre utilisateur');
    expect(badge.getAttribute('title')).toContain('Historique de prix disponible');
  });

  it('renomme un ticker après confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TickersManager />);
    await screen.findByText('AIR.PA');
    await user.click(screen.getByLabelText('Modifier AIR.PA'));
    const input = screen.getByLabelText('Nouveau ticker');
    expect(screen.queryByText(/\{\{ticker\}\}/)).not.toBeInTheDocument();
    const hint = screen.getByText(
      (_, el) =>
        el?.classList.contains('text-content-muted') === true &&
        el.textContent?.includes('AIR.PA') === true,
    );
    expect(hint).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, 'airbus');
    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('AIR.PA'));
  });
});
