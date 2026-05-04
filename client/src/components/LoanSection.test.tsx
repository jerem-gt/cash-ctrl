import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LOAN_ACCOUNT } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { LoanSection } from './LoanSection';

// LOAN_INSTALLMENTS fixture : 3 mensualités
//   101 → transaction_id=null            → Planifié
//   102 → transaction_validated=1        → Payé  (principal 310,90 / intérêts 48,71)
//   103 → transaction_validated=0        → En attente  (intérêts 47,42)

function renderLoanSection({ onClose = vi.fn(), closed = false } = {}) {
  const account = closed ? { ...LOAN_ACCOUNT, closed_at: '2025-12-31' } : LOAN_ACCOUNT;
  return renderWithProviders(<LoanSection account={account} onClose={onClose} />);
}

// Avant ouverture de l'édition, l'ordre des boutons dans le DOM est :
//   0 = Modifier | 1 = Crayon(101) | 2 = Crayon(103) | 3 = Clôturer
// Après clic sur le crayon 101, l'édition remplace les boutons de la ligne :
//   0 = Modifier | 1 = Check | 2 = X | 3 = Crayon(103) | 4 = Clôturer

describe('LoanSection', () => {
  it('affiche les paramètres fixes du prêt après chargement', async () => {
    renderLoanSection();
    await screen.findByText('Détails du prêt');
    expect(screen.getByText('36 mois')).toBeInTheDocument();
    expect(screen.getByText('5,00 %')).toBeInTheDocument();
    expect(screen.getByText('359,61 €')).toBeInTheDocument();
  });

  it('affiche les stats de capital calculées depuis les mensualités validées', async () => {
    renderLoanSection();
    // Attendre que les mensualités soient chargées (2 requêtes : loan puis installments)
    await screen.findByText('Échéancier (3 mensualités)');
    // 310,90 € apparaît dans le récapitulatif (Remboursé) ET dans la colonne Capital de la table
    expect(screen.getAllByText('310,90 €')).toHaveLength(2);
    // 11 689,10 € = capitalRestantDu, unique dans la page
    expect(screen.getByText(/11\D689,10/)).toBeInTheDocument();
  });

  it("affiche les stats d'intérêts calculées depuis les mensualités", async () => {
    renderLoanSection();
    await screen.findByText('Échéancier (3 mensualités)');
    // 48,71 € apparaît dans le récapitulatif (Payés) ET dans la colonne Intérêts de la table
    expect(screen.getAllByText('48,71 €')).toHaveLength(2);
    // 97,42 € = somme des intérêts restants (50 + 47,42), unique dans la page
    expect(screen.getByText('97,42 €')).toBeInTheDocument();
  });

  it("affiche les 3 mensualités dans l'échéancier", async () => {
    renderLoanSection();
    await screen.findByText('Échéancier (3 mensualités)');
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('affiche les badges de statut Payé / En attente / Planifié', async () => {
    renderLoanSection();
    await screen.findByText('Planifié'); // dernier badge à apparaître (installments chargés)
    expect(screen.getByText('Payé')).toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();
  });

  it("ouvre le formulaire d'édition du prêt au clic sur Modifier", async () => {
    const user = userEvent.setup();
    renderLoanSection();
    await screen.findByText('Modifier');
    await user.click(screen.getByText('Modifier'));
    expect(screen.getByText('Modifier le prêt')).toBeInTheDocument();
  });

  it("affiche les champs d'édition au clic sur le crayon d'une mensualité", async () => {
    const user = userEvent.setup();
    renderLoanSection();
    await screen.findByText('Planifié');
    await user.click(screen.getAllByRole('button')[1]); // Crayon(101)
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it("annule l'édition au clic sur le bouton X", async () => {
    const user = userEvent.setup();
    renderLoanSection();
    await screen.findByText('Planifié');
    await user.click(screen.getAllByRole('button')[1]); // Crayon(101) → édition ouverte
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button')[2]); // X
    await waitFor(() => expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument());
  });

  it("sauvegarde les modifications d'une mensualité et ferme l'édition", async () => {
    const user = userEvent.setup();
    renderLoanSection();
    await screen.findByText('Planifié');
    await user.click(screen.getAllByRole('button')[1]); // Crayon(101)
    await user.clear(screen.getByRole('spinbutton'));
    await user.type(screen.getByRole('spinbutton'), '400');
    await user.click(screen.getAllByRole('button')[1]); // Check
    await waitFor(() => expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument());
  });

  it('affiche un toast si le montant saisi est invalide (≤ 0)', async () => {
    const user = userEvent.setup();
    renderLoanSection();
    await screen.findByText('Planifié');
    await user.click(screen.getAllByRole('button')[1]); // Crayon(101)
    await user.clear(screen.getByRole('spinbutton'));
    await user.type(screen.getByRole('spinbutton'), '0');
    await user.click(screen.getAllByRole('button')[1]); // Check
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('invalides'),
    );
  });

  it('affiche le bouton Clôturer le prêt quand le compte est ouvert', async () => {
    renderLoanSection();
    await screen.findByText('Détails du prêt');
    expect(screen.getByRole('button', { name: 'Clôturer le prêt' })).toBeInTheDocument();
  });

  it('masque le bouton Clôturer le prêt quand le compte est clôturé', async () => {
    renderLoanSection({ closed: true });
    await screen.findByText('Détails du prêt');
    expect(screen.queryByRole('button', { name: 'Clôturer le prêt' })).not.toBeInTheDocument();
  });

  it('appelle onClose au clic sur Clôturer le prêt', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderLoanSection({ onClose });
    await screen.findByText('Clôturer le prêt');
    await user.click(screen.getByRole('button', { name: 'Clôturer le prêt' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
