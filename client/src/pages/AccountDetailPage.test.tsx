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

  it("ouvre le modal d'ajout pré-rempli avec ce compte", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Courses');
    await user.click(screen.getByRole('button', { name: /\+ transaction/i }));
    expect(screen.getByText('Transaction validée')).toBeInTheDocument();
  });

  it("affiche le bon message lors de la suppression d'un transfert", async () => {
    const user = userEvent.setup();
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
    const deleteBtn = await screen.findByRole('button', { name: 'Supprimer' });
    await user.click(deleteBtn);
    await user.click(screen.getByRole('button', { name: /confirmer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Transfert supprimé'),
    );
  });

  it("soumet le formulaire d'édition pour un transfert", async () => {
    const user = userEvent.setup();
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
    const editBtn = await screen.findByRole('button', { name: 'Modifier' });
    await user.click(editBtn);
    await screen.findByText('Compte destination');

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Transfert modifié'),
    );
  });
});
