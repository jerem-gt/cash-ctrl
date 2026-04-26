import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  ACCOUNTS,
  CATEGORIES,
  PAYMENT_METHODS,
  TRANSACTIONS,
  TWO_ACCOUNTS,
} from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import type { Transaction } from '@/types';

import { TxModal } from './TxModal';

const logoMap: Record<string, string | null> = { BNP: null };
const baseTx = TRANSACTIONS.data[0];
const transferTx: Transaction = { ...baseTx, transfer_peer_id: 42 };

const createProps = {
  mode: 'create' as const,
  accounts: TWO_ACCOUNTS,
  logoMap,
  categories: CATEGORIES,
  paymentMethods: PAYMENT_METHODS,
  onClose: vi.fn(),
};

const editProps = {
  mode: 'edit' as const,
  tx: baseTx,
  accounts: TWO_ACCOUNTS,
  logoMap,
  categories: CATEGORIES,
  paymentMethods: PAYMENT_METHODS,
  onClose: vi.fn(),
  onSave: vi.fn(),
  isPending: false,
};

describe('TxModal — mode création', () => {
  it('affiche le titre "Nouvelle transaction"', () => {
    renderWithProviders(<TxModal {...createProps} />);
    expect(screen.getByText('Nouvelle transaction')).toBeInTheDocument();
  });

  it('affiche les onglets Transaction et Transfert', () => {
    renderWithProviders(<TxModal {...createProps} />);
    expect(screen.getByRole('button', { name: 'Transaction' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Transfert' })).toBeInTheDocument();
  });

  it('affiche le bouton "Ajouter"', () => {
    renderWithProviders(<TxModal {...createProps} />);
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
  });

  it('bascule le titre en "Nouveau transfert" au clic sur l\'onglet Transfert', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} />);
    await user.click(screen.getByRole('button', { name: 'Transfert' }));
    expect(screen.getByText('Nouveau transfert')).toBeInTheDocument();
  });

  it('affiche "Transférer" comme bouton de soumission en mode transfert', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} />);
    await user.click(screen.getByRole('button', { name: 'Transfert' }));
    expect(screen.getByRole('button', { name: 'Transférer' })).toBeInTheDocument();
  });

  it('affiche un toast si soumis sans remplir les champs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} />);
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('obligatoires'),
    );
  });

  it('appelle onClose au clic sur Annuler', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("affiche un toast de succès et ferme le modal après la création d'une transaction", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<TxModal {...createProps} onClose={onClose} />);

    // 1. Remplir le montant et la description (champs obligatoires)
    await user.type(screen.getByPlaceholderText('0,00'), '42.50');
    await user.type(screen.getByPlaceholderText(/Ex : Course/i), 'Courses hebdo');

    // Sélectionner le compte (AccountSelect)
    await user.click(document.getElementById('source-account-select')!);
    await user.click(screen.getByText(ACCOUNTS[0].name));

    // 2. Sélectionner une catégorie (le premier choix par défaut si non sélectionné)
    await user.selectOptions(
      document.getElementById('categorie-select')!,
      CATEGORIES[0].id.toString(),
    );
    // 3. Sélectionner un moyen de paiement
    await user.selectOptions(
      document.getElementById('payment-method-select')!,
      PAYMENT_METHODS[0].id.toString(),
    );

    // 4. Soumettre
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    // 5. Vérifier que onSuccess a été déclenché
    await waitFor(() => {
      expect(document.getElementById('toast')?.textContent).toContain('Transaction ajoutée ✓');
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('affiche un toast de succès et ferme le modal après un transfert réussi', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<TxModal {...createProps} onClose={onClose} />);

    // 1. Passer en mode transfert
    await user.click(screen.getByRole('button', { name: 'Transfert' }));

    // 2. Remplir les champs obligatoires du transfert
    await user.type(screen.getByPlaceholderText('0,00'), '100');

    // Sélectionner le compte de destination (AccountSelect)
    await user.click(document.getElementById('dest-account-select')!);
    // On sélectionne le deuxième compte des fixtures (différent du source)
    await user.click(screen.getByText(TWO_ACCOUNTS[1].name));

    // 3. Soumettre
    await user.click(screen.getByRole('button', { name: 'Transférer' }));

    // 4. Vérifier les callbacks
    await waitFor(() => {
      expect(document.getElementById('toast')?.textContent).toContain('Transfert effectué ✓');
    });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('TxModal — mode duplication', () => {
  it('affiche le titre "Dupliquer la transaction"', () => {
    renderWithProviders(<TxModal {...createProps} duplicateFrom={baseTx} />);
    expect(screen.getByText('Dupliquer la transaction')).toBeInTheDocument();
  });

  it('affiche le titre "Dupliquer le transfert" pour un transfert dupliqué', () => {
    renderWithProviders(<TxModal {...createProps} duplicateFrom={transferTx} />);
    expect(screen.getByText('Dupliquer le transfert')).toBeInTheDocument();
  });
});

describe('TxModal — mode édition', () => {
  it('affiche le titre "Modifier la transaction"', () => {
    renderWithProviders(<TxModal {...editProps} />);
    expect(screen.getByText('Modifier la transaction')).toBeInTheDocument();
  });

  it('affiche le bouton "Enregistrer"', () => {
    renderWithProviders(<TxModal {...editProps} />);
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument();
  });

  it('affiche la note "deux legs" pour un transfert en édition', () => {
    renderWithProviders(<TxModal {...editProps} tx={transferTx} />);
    expect(screen.getByText(/deux legs/i)).toBeInTheDocument();
  });

  it('appelle onClose au clic sur Annuler', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...editProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
