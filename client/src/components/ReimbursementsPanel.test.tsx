import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { REIMBURSEMENTS, TRANSACTIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import type { Transaction } from '@/types';

import { ReimbursementsPanel } from './ReimbursementsPanel';

const baseTx: Transaction = TRANSACTIONS.data[0]; // expense, reimbursement_status: null
const activeTx: Transaction = { ...baseTx, reimbursement_status: 'en_attente' };
const reimbursedTx: Transaction = { ...baseTx, reimbursement_status: 'rembourse' };

describe('ReimbursementsPanel — inactif', () => {
  it(`affiche le titre "Suivi remboursement"`, () => {
    renderWithProviders(<ReimbursementsPanel tx={baseTx} />);
    expect(screen.getByText('Suivi remboursement')).toBeInTheDocument();
  });

  it(`affiche "Activer" quand reimbursement_status est null`, () => {
    renderWithProviders(<ReimbursementsPanel tx={baseTx} />);
    expect(screen.getByRole('button', { name: 'Activer' })).toBeInTheDocument();
  });

  it("n'affiche pas les boutons de statut quand inactif", () => {
    renderWithProviders(<ReimbursementsPanel tx={baseTx} />);
    expect(screen.queryByRole('button', { name: /en attente/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /remboursement terminé/i }),
    ).not.toBeInTheDocument();
  });

  it(`active le suivi en cliquant "Activer"`, async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReimbursementsPanel tx={baseTx} />);
    await user.click(screen.getByRole('button', { name: 'Activer' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /actif/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /en attente/i })).toBeInTheDocument();
  });
});

describe('ReimbursementsPanel — actif (en_attente)', () => {
  it(`affiche "↩ Actif" quand reimbursement_status est en_attente`, () => {
    renderWithProviders(<ReimbursementsPanel tx={activeTx} />);
    expect(screen.getByRole('button', { name: /actif/i })).toBeInTheDocument();
  });

  it('affiche les deux boutons de statut', () => {
    renderWithProviders(<ReimbursementsPanel tx={activeTx} />);
    expect(screen.getByRole('button', { name: /en attente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remboursement terminé/i })).toBeInTheDocument();
  });

  it(`désactive le suivi en cliquant "↩ Actif"`, async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReimbursementsPanel tx={activeTx} />);
    await user.click(screen.getByRole('button', { name: /actif/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Activer' })).toBeInTheDocument(),
    );
  });

  it(`affiche le bouton "+ Lier un remboursement"`, async () => {
    renderWithProviders(<ReimbursementsPanel tx={activeTx} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /lier un remboursement/i })).toBeInTheDocument(),
    );
  });

  it(`affiche la section "Reste à charge"`, async () => {
    renderWithProviders(<ReimbursementsPanel tx={activeTx} />);
    await waitFor(() => expect(screen.getByText(/reste à charge/i)).toBeInTheDocument());
  });

  it('affiche les remboursements liés depuis le fixture', async () => {
    renderWithProviders(<ReimbursementsPanel tx={activeTx} />);
    await waitFor(() =>
      expect(screen.getByText(REIMBURSEMENTS[0].description)).toBeInTheDocument(),
    );
    // The span renders "+<fmtDec(amount)>" — match the span whose normalized textContent is "+45,00€"
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'SPAN' && (el?.textContent?.replace(/\s/g, '') ?? '') === '+45,00€',
      ),
    ).toBeInTheDocument();
  });

  it('calcule correctement le reste à charge (24,50 - 45 = 0)', async () => {
    renderWithProviders(<ReimbursementsPanel tx={activeTx} />);
    // tx.amount = 24.50, reimbursed = 45 → reste = max(0, -20.50) = 0
    // Wait for linked reimbursement to appear first so the calc updates
    await waitFor(() =>
      expect(screen.getByText(REIMBURSEMENTS[0].description)).toBeInTheDocument(),
    );
    // The remaining span (text-sm) textContent starts with "0,00" after reimbursements load
    expect(
      screen.getByText((_, el) => {
        if (el?.tagName !== 'SPAN' || !el?.className?.includes('text-sm')) return false;
        return (el?.textContent?.replace(/\s/g, '') ?? '').startsWith('0,00');
      }),
    ).toBeInTheDocument();
  });

  it('affiche le bouton × pour délier un remboursement', async () => {
    renderWithProviders(<ReimbursementsPanel tx={activeTx} />);
    await waitFor(() => expect(screen.getByTitle('Délier')).toBeInTheDocument());
  });

  it('délie un remboursement en cliquant ×', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReimbursementsPanel tx={activeTx} />);
    await waitFor(() => expect(screen.getByTitle('Délier')).toBeInTheDocument());
    await user.click(screen.getByTitle('Délier'));
    // handler responds with { ok: true }, no error toast expected
    await waitFor(() => expect(screen.queryByText(/erreur/i)).not.toBeInTheDocument());
  });
});

describe('ReimbursementsPanel — actif (rembourse)', () => {
  it(`affiche "↩ Actif" quand reimbursement_status est rembourse`, () => {
    renderWithProviders(<ReimbursementsPanel tx={reimbursedTx} />);
    expect(screen.getByRole('button', { name: /actif/i })).toBeInTheDocument();
  });
});

describe('ReimbursementsPanel — formulaire de liaison', () => {
  it(`affiche le select et les boutons Lier/Annuler après clic sur "+ Lier"`, async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReimbursementsPanel tx={activeTx} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /lier un remboursement/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /lier un remboursement/i }));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lier' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
  });

  it(`"Annuler" ferme le formulaire de liaison`, async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReimbursementsPanel tx={activeTx} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /lier un remboursement/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /lier un remboursement/i }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('button', { name: 'Lier' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lier un remboursement/i })).toBeInTheDocument();
  });

  it(`"Lier" est désactivé tant qu'aucune transaction n'est sélectionnée`, async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReimbursementsPanel tx={activeTx} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /lier un remboursement/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /lier un remboursement/i }));
    expect(screen.getByRole('button', { name: 'Lier' })).toBeDisabled();
  });

  it('lie un remboursement et ferme le formulaire après succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReimbursementsPanel tx={activeTx} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /lier un remboursement/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /lier un remboursement/i }));

    // Select first income option (after "— Choisir —")
    const select = screen.getByRole('combobox');
    const options = Array.from(select.querySelectorAll('option'));
    const firstRealOption = options.find((o) => o.value !== '');
    if (firstRealOption) {
      await user.selectOptions(select, firstRealOption.value);
      expect(screen.getByRole('button', { name: 'Lier' })).not.toBeDisabled();
      await user.click(screen.getByRole('button', { name: 'Lier' }));
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Lier' })).not.toBeInTheDocument(),
      );
    }
  });
});
