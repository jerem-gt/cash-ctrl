import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { ACCOUNTS, CATEGORIES, PAYMENT_METHODS, SCHEDULED, TRANSACTIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';
import type { Transaction } from '@/types';

import type { TxFormState } from './TxModal';
import { TxModal } from './TxModal';

const logoMap: Record<string, string | null> = { BNP: null };
const baseTx = TRANSACTIONS.data[0];
const transferTx: Transaction = { ...baseTx, transfer_peer_id: 42 };

const createProps = {
  mode: 'create' as const,
  accounts: ACCOUNTS,
  logoMap,
  categories: CATEGORIES,
  paymentMethods: PAYMENT_METHODS,
  onClose: vi.fn(),
};

const editProps = {
  mode: 'edit' as const,
  tx: baseTx,
  accounts: ACCOUNTS,
  logoMap,
  categories: CATEGORIES,
  paymentMethods: PAYMENT_METHODS,
  onClose: vi.fn(),
  onSave: vi.fn(),
  isPending: false,
};

describe('TxModal — mode création', () => {
  it(`affiche le titre "Nouvelle transaction"`, () => {
    renderWithProviders(<TxModal {...createProps} />);
    expect(screen.getByText('Nouvelle transaction')).toBeInTheDocument();
  });

  it('affiche les onglets Transaction et Transfert', () => {
    renderWithProviders(<TxModal {...createProps} />);
    expect(screen.getByRole('button', { name: 'Transaction' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Transfert' })).toBeInTheDocument();
  });

  it(`affiche le bouton "Ajouter"`, () => {
    renderWithProviders(<TxModal {...createProps} />);
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
  });

  it(`bascule le titre en "Nouveau transfert" au clic sur l'onglet Transfert`, async () => {
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} />);
    await user.click(screen.getByRole('button', { name: 'Transfert' }));
    expect(screen.getByText('Nouveau transfert')).toBeInTheDocument();
  });

  it(`affiche "Transférer" comme bouton de soumission en mode transfert`, async () => {
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

    // 2. Sélectionner une catégorie
    await user.selectOptions(
      document.getElementById('category-select')!,
      CATEGORIES[0].id.toString(),
    );
    // 3. Sélectionner une sous-catégorie
    await user.selectOptions(
      document.getElementById('subcategory-select')!,
      CATEGORIES[0].subcategories[0].id.toString(),
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
    await user.click(screen.getByText(ACCOUNTS[1].name));

    // 3. Soumettre
    await user.click(screen.getByRole('button', { name: 'Transférer' }));

    // 4. Vérifier les callbacks
    await waitFor(() => {
      expect(document.getElementById('toast')?.textContent).toContain('Transfert effectué ✓');
    });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('TxModal — ventilation', () => {
  it(`affiche le bouton "Ventiler" en mode création`, () => {
    renderWithProviders(<TxModal {...createProps} />);
    expect(screen.getByRole('button', { name: 'Ventiler' })).toBeInTheDocument();
  });

  it(`pas de bouton "Ventiler" en mode transfert`, async () => {
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} />);
    await user.click(screen.getByRole('button', { name: 'Transfert' }));
    expect(screen.queryByRole('button', { name: 'Ventiler' })).not.toBeInTheDocument();
  });

  it("clic sur Ventiler masque les catégories et affiche l'éditeur de ventilation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} />);
    expect(screen.getByText('Alimentation')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ventiler' }));
    expect(screen.queryByText('Alimentation')).not.toBeInTheDocument();
    expect(screen.getByText('Ventilation')).toBeInTheDocument();
  });

  it('clic à nouveau sur Ventilée repasse en mode normal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} />);
    await user.click(screen.getByRole('button', { name: 'Ventiler' }));
    await user.click(screen.getByRole('button', { name: '⊕ Ventilée' }));
    expect(screen.getByText('Alimentation')).toBeInTheDocument();
    expect(screen.queryByText('Ventilation')).not.toBeInTheDocument();
  });

  it('toast si soumis en mode ventilé sans ligne de ventilation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} />);
    await user.click(screen.getByRole('button', { name: 'Ventiler' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('Ajoutez'));
  });
});

describe('TxModal — mode duplication', () => {
  it(`affiche le titre "Dupliquer la transaction"`, () => {
    renderWithProviders(<TxModal {...createProps} duplicateFrom={baseTx} />);
    expect(screen.getByText('Dupliquer la transaction')).toBeInTheDocument();
  });

  it(`affiche le titre "Dupliquer le transfert" pour un transfert dupliqué`, () => {
    renderWithProviders(<TxModal {...createProps} duplicateFrom={transferTx} />);
    expect(screen.getByText('Dupliquer le transfert')).toBeInTheDocument();
  });
});

describe('TxModal — champ Planification', () => {
  it('affiche le select Planification en mode édition quand des planifications du même type existent', async () => {
    renderWithProviders(<TxModal {...editProps} />);
    await waitFor(() => expect(document.getElementById('scheduled-select')).toBeInTheDocument());
    expect(screen.getByRole('option', { name: SCHEDULED[0].description })).toBeInTheDocument();
  });

  it("n'affiche pas le select pour un transfert en édition", () => {
    renderWithProviders(<TxModal {...editProps} tx={transferTx} />);
    expect(document.getElementById('scheduled-select')).not.toBeInTheDocument();
  });

  it("n'affiche pas le select si aucune planification du même type n'est active", async () => {
    server.use(
      http.get('/api/scheduled', () => HttpResponse.json([{ ...SCHEDULED[0], type: 'income' }])),
    );
    renderWithProviders(<TxModal {...editProps} />);
    // On attend que la query se résolve, puis vérifie l'absence du select
    await waitFor(() =>
      expect(document.getElementById('scheduled-select')).not.toBeInTheDocument(),
    );
  });

  it('inclut scheduled_id dans onSave lors de la soumission', async () => {
    const onSave = vi.fn<(data: TxFormState) => void>();
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...editProps} onSave={onSave} />);
    await waitFor(() => expect(document.getElementById('scheduled-select')).toBeInTheDocument());
    await user.selectOptions(document.getElementById('scheduled-select')!, String(SCHEDULED[0].id));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSave).toHaveBeenCalledOnce();
    expect((onSave.mock.calls[0][0] as TxFormState).scheduled_id).toBe(SCHEDULED[0].id);
  });

  it('inclut scheduled_id null dans onSave quand on détache', async () => {
    const linkedTx = { ...TRANSACTIONS.data[0], scheduled_id: SCHEDULED[0].id };
    const onSave = vi.fn<(data: TxFormState) => void>();
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...editProps} tx={linkedTx} onSave={onSave} />);
    await waitFor(() => expect(document.getElementById('scheduled-select')).toBeInTheDocument());
    await user.selectOptions(document.getElementById('scheduled-select')!, '');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSave).toHaveBeenCalledOnce();
    expect((onSave.mock.calls[0][0] as TxFormState).scheduled_id).toBeNull();
  });
});

describe('TxModal — mode édition', () => {
  it(`affiche le titre "Modifier la transaction"`, () => {
    renderWithProviders(<TxModal {...editProps} />);
    expect(screen.getByText('Modifier la transaction')).toBeInTheDocument();
  });

  it(`affiche le bouton "Enregistrer"`, () => {
    renderWithProviders(<TxModal {...editProps} />);
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument();
  });

  it(`affiche la note "deux legs" pour un transfert en édition`, () => {
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
