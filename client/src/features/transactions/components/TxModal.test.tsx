import type { Transaction } from '@cashctrl/types';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { TxFormState } from '@/features/transactions/lib/txForm.ts';
import { ACCOUNTS, CATEGORIES, PAYMENT_METHODS, SCHEDULED, TRANSACTIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

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

  it('affiche le select même si la planification est de type différent (income vs expense)', async () => {
    server.use(
      http.get('/api/scheduled', () => HttpResponse.json([{ ...SCHEDULED[0], type: 'income' }])),
    );
    renderWithProviders(<TxModal {...editProps} />);
    await waitFor(() => expect(document.getElementById('scheduled-select')).toBeInTheDocument());
  });

  it("n'affiche pas le select si toutes les planifications actives sont des transferts", async () => {
    server.use(
      http.get('/api/scheduled', () => HttpResponse.json([{ ...SCHEDULED[0], to_account_id: 2 }])),
    );
    renderWithProviders(<TxModal {...editProps} />);
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
    expect(onSave.mock.calls[0][0].scheduled_id).toBe(SCHEDULED[0].id);
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
    expect(onSave.mock.calls[0][0].scheduled_id).toBeNull();
  });
});

describe('TxModal — mise en évidence des champs invalides', () => {
  it('passe le champ montant en border-danger si soumis vide', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} />);
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(screen.getByPlaceholderText('0,00')).toHaveClass('border-danger'));
  });

  it('passe le champ montant en border-danger si soumis avec la valeur "0"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} />);
    await user.type(screen.getByPlaceholderText('0,00'), '0');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(screen.getByPlaceholderText('0,00')).toHaveClass('border-danger'));
  });

  it('passe le select catégorie en border-danger si soumis sans catégorie', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} />);
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() =>
      expect(document.getElementById('category-select')).toHaveClass('border-danger'),
    );
  });

  it('ne passe pas le select sous-catégorie en rouge si la catégorie est vide', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} />);
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() =>
      expect(document.getElementById('subcategory-select')).not.toHaveClass('border-danger'),
    );
  });

  it('passe le select sous-catégorie en border-danger si catégorie choisie mais sous-catégorie vide', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} />);
    await user.selectOptions(document.getElementById('category-select')!, String(CATEGORIES[0].id));
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() =>
      expect(document.getElementById('subcategory-select')).toHaveClass('border-danger'),
    );
  });

  it("efface le border-danger du montant dès que l'utilisateur saisit une valeur", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} />);
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(screen.getByPlaceholderText('0,00')).toHaveClass('border-danger'));
    await user.type(screen.getByPlaceholderText('0,00'), '10');
    expect(screen.getByPlaceholderText('0,00')).not.toHaveClass('border-danger');
  });

  it('efface toutes les erreurs au basculement de mode Transaction → Transfert', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TxModal {...createProps} />);
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(screen.getByPlaceholderText('0,00')).toHaveClass('border-danger'));
    await user.click(screen.getByRole('button', { name: 'Transfert' }));
    expect(screen.getByPlaceholderText('0,00')).not.toHaveClass('border-danger');
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
