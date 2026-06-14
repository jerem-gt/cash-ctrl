import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { CategorizationRulesCard } from './CategorizationRulesCard';

const RULE = { id: 1, user_id: 1, pattern: '%leclerc%', subcategory_id: 1, sort_order: 0 };

describe('CategorizationRulesCard', () => {
  it("affiche le message vide s'il n'y a aucune règle", async () => {
    renderWithProviders(<CategorizationRulesCard />);
    expect(await screen.findByText(/Aucune règle/)).toBeInTheDocument();
  });

  it('affiche les règles existantes', async () => {
    server.use(http.get('/api/categorization-rules', () => HttpResponse.json([RULE])));
    renderWithProviders(<CategorizationRulesCard />);
    expect(await screen.findByText('%leclerc%')).toBeInTheDocument();
  });

  it("affiche le formulaire d'ajout après clic sur Ajouter une règle", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategorizationRulesCard />);
    await user.click(await screen.findByText('Ajouter une règle'));
    expect(screen.getByPlaceholderText('%leclerc%')).toBeInTheDocument();
  });

  it('ouvre la modale de confirmation au clic sur Tout supprimer', async () => {
    server.use(http.get('/api/categorization-rules', () => HttpResponse.json([RULE])));
    const user = userEvent.setup();
    renderWithProviders(<CategorizationRulesCard />);
    await user.click(await screen.findByText('Tout supprimer'));
    expect(
      await screen.findByRole('heading', { name: 'Supprimer toutes les règles ?' }),
    ).toBeInTheDocument();
  });

  it('appelle DELETE / et ferme la modale après confirmation', async () => {
    server.use(http.get('/api/categorization-rules', () => HttpResponse.json([RULE])));
    let deleteCalled = false;
    server.use(
      http.delete('/api/categorization-rules', () => {
        deleteCalled = true;
        return HttpResponse.json({ deleted: 1 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CategorizationRulesCard />);
    await user.click(await screen.findByText('Tout supprimer'));
    const confirmBtn = await screen.findByRole('button', { name: 'Confirmer' });
    await user.click(confirmBtn);
    await waitFor(() => expect(deleteCalled).toBe(true));
  });
});
