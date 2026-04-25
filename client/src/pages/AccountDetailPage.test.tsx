import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

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
    await screen.findByText('Aucune transaction sur ce compte');
  });
});
