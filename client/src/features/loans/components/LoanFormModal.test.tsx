import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { LOAN, LOAN_ACCOUNT } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { LoanFormModal } from './LoanFormModal';

describe('LoanFormModal — mode creation', () => {
  it('affiche le titre Nouveau pret', () => {
    renderWithProviders(<LoanFormModal mode="create" onClose={vi.fn()} />);
    expect(screen.getByText('Nouveau prêt')).toBeInTheDocument();
  });

  it('affiche le bouton Creer le pret', () => {
    renderWithProviders(<LoanFormModal mode="create" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Créer le prêt' })).toBeInTheDocument();
  });

  it('ferme le modal au clic sur Annuler', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<LoanFormModal mode="create" onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('affiche un toast si le nom est vide', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoanFormModal mode="create" onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Créer le prêt' }));
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('nom'));
  });

  it('affiche la mensualite estimee quand les 3 parametres sont renseignes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoanFormModal mode="create" onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Ex : 200000'), '12000');
    await user.type(screen.getByPlaceholderText('Ex : 3.5'), '12');
    await user.type(screen.getByPlaceholderText('Ex : 240'), '12');

    await waitFor(() => expect(screen.getByText('Mensualité estimée')).toBeInTheDocument());
  });

  it('soumet le formulaire et ferme le modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<LoanFormModal mode="create" onClose={onClose} />);

    await user.type(screen.getByPlaceholderText('Ex : Prêt immobilier'), 'Mon pret');
    await user.type(screen.getByPlaceholderText('Ex : 200000'), '12000');
    await user.type(screen.getByPlaceholderText('Ex : 3.5'), '5');
    await user.type(screen.getByPlaceholderText('Ex : 240'), '36');

    const selectCompteCred = await screen.findByLabelText(
      /Choisir le compte crédité à l'ouverture/i,
    );
    await user.selectOptions(selectCompteCred, ['1']);
    const selectCompteDeb = await screen.findByLabelText(
      /Choisir le compte à débiter pour les remboursements/i,
    );
    await user.selectOptions(selectCompteDeb, ['1']);

    await user.click(screen.getByRole('button', { name: 'Créer le prêt' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(document.getElementById('toast')?.textContent).toContain('créé');
  });

  it("affiche un toast erreur si l'API echoue", async () => {
    server.use(
      http.post('/api/loans', () =>
        HttpResponse.json({ error: "Type de compte 'Prêt' introuvable" }, { status: 400 }),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(<LoanFormModal mode="create" onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Ex : Prêt immobilier'), 'Mon pret');
    await user.type(screen.getByPlaceholderText('Ex : 200000'), '12000');
    await user.type(screen.getByPlaceholderText('Ex : 3.5'), '5');
    await user.type(screen.getByPlaceholderText('Ex : 240'), '36');

    const selectCompteCred = await screen.findByLabelText(
      /Choisir le compte crédité à l'ouverture/i,
    );
    await user.selectOptions(selectCompteCred, ['1']);
    const selectCompteDeb = await screen.findByLabelText(
      /Choisir le compte à débiter pour les remboursements/i,
    );
    await user.selectOptions(selectCompteDeb, ['1']);

    await user.click(screen.getByRole('button', { name: 'Créer le prêt' }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('introuvable'),
    );
  });
});

describe('LoanFormModal — mode edition', () => {
  it('affiche le titre Modifier le pret', () => {
    renderWithProviders(
      <LoanFormModal mode="edit" account={LOAN_ACCOUNT} loan={LOAN} onClose={vi.fn()} />,
    );
    expect(screen.getByText('Modifier le prêt')).toBeInTheDocument();
  });

  it('pre-remplit le formulaire depuis les donnees du pret', () => {
    renderWithProviders(
      <LoanFormModal mode="edit" account={LOAN_ACCOUNT} loan={LOAN} onClose={vi.fn()} />,
    );

    expect(screen.getByPlaceholderText('Ex : Prêt immobilier')).toHaveValue(LOAN_ACCOUNT.name);
    expect(screen.getByPlaceholderText('Ex : 200000')).toHaveValue(
      LOAN.principal_amount.toFixed(2),
    );
    expect(screen.getByPlaceholderText('Ex : 3.5')).toHaveValue(LOAN.interest_rate * 100);
    expect(screen.getByPlaceholderText('Ex : 240')).toHaveValue(LOAN.duration_months);
  });

  it('prérempli le taux avec un point décimal, jamais un séparateur de milliers', () => {
    renderWithProviders(
      <LoanFormModal
        mode="edit"
        account={LOAN_ACCOUNT}
        loan={{ ...LOAN, interest_rate: 12.345 }}
        onClose={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText('Ex : 3.5');
    expect(input.value).toBe('1234.5');
  });

  it("desactive les champs qui affectent l'echeancier", () => {
    renderWithProviders(
      <LoanFormModal mode="edit" account={LOAN_ACCOUNT} loan={LOAN} onClose={vi.fn()} />,
    );

    expect(screen.getByPlaceholderText('Ex : 200000')).toBeDisabled();
    expect(screen.getByPlaceholderText('Ex : 3.5')).toBeDisabled();
    expect(screen.getByPlaceholderText('Ex : 240')).toBeDisabled();
  });

  it('active le champ nom', () => {
    renderWithProviders(
      <LoanFormModal mode="edit" account={LOAN_ACCOUNT} loan={LOAN} onClose={vi.fn()} />,
    );

    expect(screen.getByPlaceholderText('Ex : Prêt immobilier')).not.toBeDisabled();
  });

  it('soumet la mise a jour et ferme le modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <LoanFormModal mode="edit" account={LOAN_ACCOUNT} loan={LOAN} onClose={onClose} />,
    );

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(document.getElementById('toast')?.textContent).toContain('mis à jour');
  });

  it('affiche un toast erreur si la mise a jour echoue', async () => {
    server.use(
      http.patch('/api/loans/:loanId', () =>
        HttpResponse.json({ error: 'Prêt introuvable' }, { status: 404 }),
      ),
    );

    const user = userEvent.setup();
    renderWithProviders(
      <LoanFormModal mode="edit" account={LOAN_ACCOUNT} loan={LOAN} onClose={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('introuvable'),
    );
  });
});
