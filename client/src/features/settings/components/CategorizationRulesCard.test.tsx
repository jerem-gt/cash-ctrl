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

  it('ferme la modale de suppression totale au clic sur Annuler', async () => {
    server.use(http.get('/api/categorization-rules', () => HttpResponse.json([RULE])));
    const user = userEvent.setup();
    renderWithProviders(<CategorizationRulesCard />);
    await user.click(await screen.findByText('Tout supprimer'));
    await screen.findByRole('heading', { name: 'Supprimer toutes les règles ?' });
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(
      screen.queryByRole('heading', { name: 'Supprimer toutes les règles ?' }),
    ).not.toBeInTheDocument();
  });
});

describe('CategorizationRulesCard — édition de règle', () => {
  it('passe en mode édition au clic sur Modifier', async () => {
    server.use(http.get('/api/categorization-rules', () => HttpResponse.json([RULE])));
    const user = userEvent.setup();
    renderWithProviders(<CategorizationRulesCard />);
    await user.click(await screen.findByText('Modifier'));
    expect(screen.getByDisplayValue('%leclerc%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument();
  });

  it("annule l'édition au clic sur Annuler", async () => {
    server.use(http.get('/api/categorization-rules', () => HttpResponse.json([RULE])));
    const user = userEvent.setup();
    renderWithProviders(<CategorizationRulesCard />);
    await user.click(await screen.findByText('Modifier'));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByDisplayValue('%leclerc%')).not.toBeInTheDocument();
    expect(await screen.findByText('Modifier')).toBeInTheDocument();
  });

  it("affiche un toast si le motif est vide à l'enregistrement", async () => {
    server.use(http.get('/api/categorization-rules', () => HttpResponse.json([RULE])));
    const user = userEvent.setup();
    renderWithProviders(<CategorizationRulesCard />);
    await user.click(await screen.findByText('Modifier'));
    await user.clear(screen.getByDisplayValue('%leclerc%'));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Saisissez un motif.')).toBeInTheDocument();
  });

  it('enregistre la modification et affiche le toast de succès', async () => {
    server.use(http.get('/api/categorization-rules', () => HttpResponse.json([RULE])));
    const user = userEvent.setup();
    renderWithProviders(<CategorizationRulesCard />);
    await user.click(await screen.findByText('Modifier'));
    const patternInput = screen.getByDisplayValue('%leclerc%');
    await user.clear(patternInput);
    await user.type(patternInput, '%carrefour%');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Règle mise à jour ✓')).toBeInTheDocument();
  });

  it('supprime la règle au clic sur ✕ et affiche le toast de succès', async () => {
    server.use(http.get('/api/categorization-rules', () => HttpResponse.json([RULE])));
    let deleteCalled = false;
    server.use(
      http.delete('/api/categorization-rules/:id', () => {
        deleteCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CategorizationRulesCard />);
    await user.click(await screen.findByText('✕'));
    await waitFor(() => expect(deleteCalled).toBe(true));
    expect(await screen.findByText('Règle supprimée')).toBeInTheDocument();
  });
});

describe("CategorizationRulesCard — formulaire d'ajout", () => {
  it('affiche un toast si le motif est vide', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategorizationRulesCard />);
    await user.click(await screen.findByText('Ajouter une règle'));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Saisissez un motif.')).toBeInTheDocument();
  });

  it('affiche un toast si la sous-catégorie est absente', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategorizationRulesCard />);
    await user.click(await screen.findByText('Ajouter une règle'));
    await user.type(screen.getByPlaceholderText('%leclerc%'), '%test%');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Choisissez une sous-catégorie.')).toBeInTheDocument();
  });

  it('crée une règle avec succès et réinitialise le formulaire', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategorizationRulesCard />);
    await user.click(await screen.findByText('Ajouter une règle'));
    await user.type(screen.getByPlaceholderText('%leclerc%'), '%test%');
    await user.selectOptions(screen.getByRole('combobox'), '1');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Règle ajoutée ✓')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('%leclerc%')).not.toBeInTheDocument();
  });

  it("ferme le formulaire d'ajout au clic sur Annuler", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategorizationRulesCard />);
    await user.click(await screen.findByText('Ajouter une règle'));
    expect(screen.getByPlaceholderText('%leclerc%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByPlaceholderText('%leclerc%')).not.toBeInTheDocument();
  });
});

describe("CategorizationRulesCard — initialiser depuis l'historique", () => {
  it('affiche le nombre de règles créées si count > 0', async () => {
    server.use(
      http.post('/api/categorization-rules/init-from-history', () =>
        HttpResponse.json({ inserted: 3 }, { status: 201 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CategorizationRulesCard />);
    await user.click(await screen.findByText("Initialiser depuis l'historique"));
    expect(await screen.findByText(/3 règle/)).toBeInTheDocument();
  });

  it("affiche un message si aucune règle n'a été créée", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategorizationRulesCard />);
    await user.click(await screen.findByText("Initialiser depuis l'historique"));
    expect(
      await screen.findByText("Aucune nouvelle règle à créer depuis l'historique"),
    ).toBeInTheDocument();
  });
});
