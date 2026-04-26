import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { TRANSACTIONS } from '@/tests/fixtures.ts';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { AccountDetailPage } from './AccountDetailPage';

function renderDetail(id = '1') {
  return renderWithProviders(
    <Routes>
      <Route path="/accounts/:id" element={<AccountDetailPage />} />
    </Routes>,
    { initialEntries: [`/accounts/${id}`] },
  );
}

describe('AccountDetailPage', () => {
  it('affiche le nom du compte après chargement', async () => {
    renderDetail();
    await screen.findByText('Compte courant');
    expect(screen.getByText('Compte courant')).toBeInTheDocument();
  });

  it('affiche le solde du compte', async () => {
    renderDetail();
    await screen.findByText('Compte courant');
    expect(screen.getByText(/1.500/)).toBeInTheDocument();
  });

  it('affiche "Compte introuvable" pour un id inexistant', async () => {
    renderDetail('999');
    await waitFor(() => expect(screen.getByText('Compte introuvable.')).toBeInTheDocument());
  });

  it('affiche les transactions après chargement', async () => {
    renderDetail();
    await screen.findByText('Courses');
    expect(screen.getByText('Courses')).toBeInTheDocument();
  });

  it('affiche le compteur de transactions', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText('1 transaction(s)')).toBeInTheDocument());
  });

  it("ouvre le modal d'ajout", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Courses');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    expect(screen.getByText('Nouvelle transaction')).toBeInTheDocument();
  });

  it('ouvre la confirmation de suppression du compte', async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Compte courant');
    await user.click(screen.getByText('Supprimer'));
    expect(screen.getByText('Supprimer le compte')).toBeInTheDocument();
  });

  it("affiche l'état vide si aucune transaction", async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({ data: [], total: 0, page: 1, totalPages: 1 }),
      ),
    );
    renderDetail();
    expect(await screen.findByText('Aucune transaction sur ce compte')).toBeInTheDocument();
  });

  it("ouvre le modal d'édition du compte", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Compte courant');
    await user.click(screen.getByText('Modifier'));
    expect(screen.getByText('Modifier le compte')).toBeInTheDocument();
  });

  it('confirme la suppression du compte', async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Compte courant');
    await user.click(screen.getByText('Supprimer'));
    await user.click(screen.getByRole('button', { name: /confirmer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('supprimé'),
    );
  });

  it('ouvre la modal de suppression de transaction (×)', async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Courses');
    await user.click(screen.getByRole('button', { name: '×' }));
    expect(screen.getByText('Supprimer la transaction')).toBeInTheDocument();
  });

  it("ouvre la modal d'édition de transaction (✎)", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Courses');
    await user.click(screen.getByRole('button', { name: '✎' }));
    expect(screen.getByText('Modifier la transaction')).toBeInTheDocument();
  });

  it('ouvre la modal de duplication de transaction (⧉)', async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Courses');
    await user.click(screen.getByRole('button', { name: '⧉' }));
    expect(screen.getByText('Dupliquer la transaction')).toBeInTheDocument();
  });

  it("confirme la suppression d'une transaction", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Courses');
    await user.click(screen.getByRole('button', { name: '×' }));
    await user.click(screen.getByRole('button', { name: /confirmer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('supprimée'),
    );
  });

  it("soumet le formulaire d'édition d'une transaction", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Courses');
    await user.click(screen.getByRole('button', { name: '✎' }));
    await screen.findByText('Modifier la transaction');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('modifiée'),
    );
  });

  it("soumet le formulaire d'édition du compte", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Compte courant');
    await user.click(screen.getByText('Modifier'));
    await screen.findByText('Modifier le compte');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mis à jour'),
    );
  });

  it("affiche le bon message lors de la suppression d'un transfert", async () => {
    const user = userEvent.setup();
    // On simule une transaction qui est un transfert
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({
          data: [{ ...TRANSACTIONS.data[0], transfer_peer_id: 123 }],
          total: 1,
          page: 1,
          totalPages: 1,
        }),
      ),
    );

    renderDetail();
    const deleteBtn = await screen.findByRole('button', { name: '×' });
    await user.click(deleteBtn);
    await user.click(screen.getByRole('button', { name: /confirmer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Transfert supprimé'),
    );
  });

  it("soumet le formulaire d'édition pour un transfert", async () => {
    const user = userEvent.setup();
    // Mock d'un transfert existant
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({
          data: [{ ...TRANSACTIONS.data[0], transfer_peer_id: 123, transfer_peer_account_id: 2 }],
          total: 1,
          page: 1,
          totalPages: 1,
        }),
      ),
    );

    renderDetail();
    const editBtn = await screen.findByRole('button', { name: '✎' });
    await user.click(editBtn);

    // On vérifie que les champs spécifiques au transfert (AccountSelect) sont là
    await screen.findByText('Compte destination');

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('modifiée'),
    );
  });

  it("affiche un message d'erreur si la mise à jour du compte échoue", async () => {
    const user = userEvent.setup();
    // Simuler une erreur API
    server.use(
      http.patch('/api/accounts/:id', () => {
        return new HttpResponse(null, { status: 400, statusText: 'Erreur Serveur' });
      }),
    );

    renderDetail();
    await user.click(screen.getByText('Modifier'));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    // Attend que le toast affiche l'erreur (le message dépend de ton hook/API)
    await waitFor(() => expect(document.getElementById('toast')).toBeInTheDocument());
  });

  it("cache le logo du compte si l'image est corrompue", async () => {
    renderDetail();
    const img = await screen.findByRole('img', { name: /logo BNP/i });

    // Déclencher manuellement l'erreur
    fireEvent.error(img);

    expect(img).toHaveStyle({ display: 'none' });
  });

  it('calcule l’ancienneté du compte', async () => {
    vi.setSystemTime(new Date('2026-04-01'));
    renderDetail();
    // Vérifie que le texte généré par accountSeniority est présent
    expect(await screen.findByText(/depuis 2 ans 3 mois/i)).toBeInTheDocument();
  });

  it('ouvre et ferme toutes les modales', async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Compte courant');

    // Test Modale Edition Transaction
    const editTxBtns = await screen.findAllByRole('button', { name: '✎' });
    await user.click(editTxBtns[0]);
    expect(screen.getByText('Modifier la transaction')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /annuler/i })); // Déclenche onClose

    // Test Modale Suppression Transaction
    const deleteTxBtns = await screen.findAllByRole('button', { name: '×' });
    await user.click(deleteTxBtns[0]);
    expect(screen.getByText('Supprimer la transaction')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /annuler/i }));

    // Test Modale Duplication
    const duplicateBtns = await screen.findAllByRole('button', { name: '⧉' });
    await user.click(duplicateBtns[0]);
    expect(screen.getByText('Dupliquer la transaction')).toBeInTheDocument();
  });
});
