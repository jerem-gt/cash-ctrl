import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { SEARCH_RESPONSE } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { CommandPalette } from './CommandPalette';

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}|{JSON.stringify(location.state ?? null)}
    </div>
  );
}

function renderPalette(open: boolean, onClose = vi.fn()) {
  const utils = renderWithProviders(
    <>
      {open && <CommandPalette onClose={onClose} />}
      <LocationProbe />
    </>,
  );
  return { ...utils, onClose };
}

describe('CommandPalette', () => {
  it("ne rend rien quand elle n'est pas montée", () => {
    renderPalette(false);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('affiche les pages (client-side) sans saisie, avec le hint idle', () => {
    renderPalette(true);
    expect(screen.getByText(/toutes les transactions/i)).toBeInTheDocument();
    expect(screen.getByText('Comptes')).toBeInTheDocument();
    expect(screen.getByText(/tapez au moins 2 caractères/i)).toBeInTheDocument();
  });

  it('recherche et affiche les résultats groupés (via MSW)', async () => {
    const user = userEvent.setup();
    renderPalette(true);
    await user.type(screen.getByPlaceholderText(/rechercher/i), 'café');

    await waitFor(
      () =>
        expect(screen.getByText(SEARCH_RESPONSE.transactions[0].description)).toBeInTheDocument(),
      { timeout: 2000 },
    );
    expect(screen.getByText(SEARCH_RESPONSE.accounts[0].name)).toBeInTheDocument();
    expect(screen.getByText(SEARCH_RESPONSE.scheduled[0].description)).toBeInTheDocument();
    expect(screen.getByText(SEARCH_RESPONSE.stocks[0].ticker)).toBeInTheDocument();
  });

  it('Escape ferme la palette', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPalette(true);
    await user.type(screen.getByPlaceholderText(/rechercher/i), '{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('la navigation clavier (flèches) + Entrée ouvre le résultat surligné', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPalette(true);
    const input = screen.getByPlaceholderText(/rechercher/i);
    await user.type(input, 'café');

    await waitFor(
      () =>
        expect(screen.getByText(SEARCH_RESPONSE.transactions[0].description)).toBeInTheDocument(),
      { timeout: 2000 },
    );

    // 1er résultat (compte) surligné par défaut : ArrowDown avance vers la transaction.
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onClose).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toContain('/transactions?q=caf'),
    );
  });

  it('le clic sur une planification navigue vers /scheduled avec le state highlightScheduledId', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPalette(true);
    await user.type(screen.getByPlaceholderText(/rechercher/i), 'café');

    await waitFor(
      () => expect(screen.getByText(SEARCH_RESPONSE.scheduled[0].description)).toBeInTheDocument(),
      { timeout: 2000 },
    );
    await user.click(screen.getByText(SEARCH_RESPONSE.scheduled[0].description));

    expect(onClose).toHaveBeenCalled();
    await waitFor(() => {
      const text = screen.getByTestId('location').textContent ?? '';
      expect(text).toContain('/scheduled');
      expect(text).toContain(`"highlightScheduledId":${SEARCH_RESPONSE.scheduled[0].id}`);
    });
  });

  it('le clic sur une page navigue directement (sans appel réseau)', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPalette(true);
    await user.click(screen.getByText('Rapports'));

    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('/reports'));
  });
});
