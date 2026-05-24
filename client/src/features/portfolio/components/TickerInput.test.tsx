import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { TickerInput } from '@/features/portfolio/components/TickerInput';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

const VALID_ISIN = 'FR0014000MR3'; // 12 chars, valid format

function renderInput(value: string, onChange = vi.fn(), disabled = false) {
  return renderWithProviders(
    <TickerInput
      id="test-ticker"
      value={value}
      onChange={onChange}
      placeholder="ex: AAPL"
      disabled={disabled}
    />,
  );
}

describe('TickerInput', () => {
  it('affiche le champ input', () => {
    renderInput('');
    expect(screen.getByPlaceholderText('ex: AAPL')).toBeInTheDocument();
  });

  it('appelle onChange à la saisie', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderInput('', onChange);
    await user.type(screen.getByPlaceholderText('ex: AAPL'), 'A');
    expect(onChange).toHaveBeenCalledWith('A');
  });

  it("n'affiche pas de dropdown pour un ticker classique", () => {
    renderInput('AAPL');
    expect(screen.queryByText('Recherche en cours…')).not.toBeInTheDocument();
    expect(screen.queryByText('Décathlon SA')).not.toBeInTheDocument();
  });

  it('affiche le dropdown avec les résultats pour un ISIN valide', async () => {
    renderInput(VALID_ISIN);
    await waitFor(() => expect(screen.getByText('Décathlon SA')).toBeInTheDocument());
    expect(screen.getByText('DCAM.PA')).toBeInTheDocument();
    expect(screen.getByText('DCAM.DE')).toBeInTheDocument();
    expect(screen.getByText('Paris')).toBeInTheDocument();
  });

  it("affiche 'Aucun résultat' quand la recherche renvoie vide", async () => {
    server.use(http.get('/api/stocks/search', () => HttpResponse.json([])));
    renderInput(VALID_ISIN);
    await waitFor(() => expect(screen.getByText('Aucun résultat')).toBeInTheDocument());
  });

  it('appelle onChange avec le symbole au clic sur un résultat', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderInput(VALID_ISIN, onChange);

    await waitFor(() => screen.getByText('DCAM.PA'));
    await user.click(screen.getByRole('button', { name: /DCAM\.PA/i }));

    expect(onChange).toHaveBeenCalledWith('DCAM.PA');
  });

  it("n'affiche pas de dropdown quand le champ est disabled", () => {
    renderInput(VALID_ISIN, vi.fn(), true);
    expect(screen.queryByText('Recherche en cours…')).not.toBeInTheDocument();
    expect(screen.queryByText('Aucun résultat')).not.toBeInTheDocument();
  });
});
