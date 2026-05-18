import { screen, waitFor } from '@testing-library/react';
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
  it('affiche le squelette pendant le chargement des comptes', () => {
    server.use(http.get('/api/accounts', () => new Promise<never>(() => {})));
    renderDetail();
    expect(
      screen.queryByRole('button', { name: /\+ nouvelle transaction/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Compte introuvable.')).not.toBeInTheDocument();
  });

  it(`ne montre pas "Compte introuvable" pendant le chargement, même pour un id absent`, () => {
    server.use(http.get('/api/accounts', () => new Promise<never>(() => {})));
    renderDetail('999');
    expect(screen.queryByText('Compte introuvable.')).not.toBeInTheDocument();
  });

  it(`affiche "Compte introuvable" pour un id inexistant`, async () => {
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
      expect(document.getElementById('toast')?.textContent).toContain('Transfert modifié'),
    );
  });
});
