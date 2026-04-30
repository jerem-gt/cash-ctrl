import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import AccountDetailPage from '@/pages/AccountDetailPage.tsx';
import { TRANSACTIONS } from '@/tests/fixtures.ts';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

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
    await screen.findByText('Compte test');
    expect(screen.getByText('Compte test')).toBeInTheDocument();
  });

  it('affiche le solde du compte', async () => {
    renderDetail();
    await screen.findByText('Compte test');
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
    await user.click(screen.getByRole('button', { name: /\+ nouvelle transaction/i }));
    expect(screen.getByText('Transaction validée')).toBeInTheDocument();
  });

  it("affiche l'état vide si aucune transaction", async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({ data: [], total: 0, page: 1, totalPages: 1 }),
      ),
    );
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('Aucune transaction sur ce compte')).toBeInTheDocument();
    });
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
    await screen.findByText('Courses');
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
    await screen.findByText('Courses');
    const editBtn = await screen.findByRole('button', { name: '✎' });
    await user.click(editBtn);

    // On vérifie que les champs spécifiques au transfert (AccountSelect) sont là
    await screen.findByText('Compte destination');

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('modifiée'),
    );
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
    expect(await screen.findByText(/2 ans 3 mois/i)).toBeInTheDocument();
  });

  it('ouvre et ferme toutes les modales', async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Compte test');

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
