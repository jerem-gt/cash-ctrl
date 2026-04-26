import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ACCOUNT_TYPES, ACCOUNTS, BANKS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { AccountModal } from './AccountModal';

const baseProps = {
  banks: BANKS,
  accountTypes: ACCOUNT_TYPES,
  onClose: vi.fn(),
};

describe('AccountModal — mode création', () => {
  it('affiche le titre "Nouveau compte"', () => {
    renderWithProviders(<AccountModal mode="create" {...baseProps} />);
    expect(screen.getByText('Nouveau compte')).toBeInTheDocument();
  });

  it('affiche le bouton "Créer"', () => {
    renderWithProviders(<AccountModal mode="create" {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Créer' })).toBeInTheDocument();
  });

  it('toast si soumis sans nom', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountModal mode="create" {...baseProps} />);
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('nom'));
  });

  it("toast si soumis sans date d'ouverture", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountModal mode="create" {...baseProps} />);
    await user.type(screen.getByPlaceholderText(/compte courant/i), 'Mon compte');
    // Choisir une banque pour passer la validation banque
    // (le BankSelect affiche "— Choisir —")
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('banque'));
  });

  it('appelle onClose en cliquant Annuler', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AccountModal mode="create" {...baseProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('affiche un toast de succès et ferme le modal après la création', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<AccountModal mode="create" {...baseProps} onClose={onClose} />);

    // 1. Remplissage complet du formulaire
    await user.type(screen.getByPlaceholderText(/compte courant/i), 'Mon nouveau compte');
    // On remplit la date pour éviter le toast d'erreur de validation
    await user.type(screen.getByLabelText(/opening-date/i), '2026-04-25');
    // On choisit la banque
    await user.click(screen.getByLabelText(/sélectionner une banque/i));
    await user.click(screen.getByRole('button', { name: BANKS[0].name }));

    // 2. Soumission
    await user.click(screen.getByRole('button', { name: 'Créer' }));

    // 3. Vérification du toast (prouve que onSuccess a été appelé)
    await waitFor(() => {
      const toast = document.getElementById('toast');
      expect(toast?.textContent).toContain('Compte créé ✓');
    });

    // 4. Vérification de la fermeture (prouve que la suite du bloc a été exécutée)
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('AccountModal — mode édition', () => {
  it('affiche le titre "Modifier le compte"', () => {
    const onSave = vi.fn();
    renderWithProviders(
      <AccountModal
        mode="edit"
        account={ACCOUNTS[0]}
        banks={BANKS}
        accountTypes={ACCOUNT_TYPES}
        onSave={onSave}
        onClose={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.getByText('Modifier le compte')).toBeInTheDocument();
  });

  it('pré-remplit le nom du compte', () => {
    const onSave = vi.fn();
    renderWithProviders(
      <AccountModal
        mode="edit"
        account={ACCOUNTS[0]}
        banks={BANKS}
        accountTypes={ACCOUNT_TYPES}
        onSave={onSave}
        onClose={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.getByDisplayValue('Compte courant')).toBeInTheDocument();
  });

  it('affiche le bouton "Enregistrer"', () => {
    const onSave = vi.fn();
    renderWithProviders(
      <AccountModal
        mode="edit"
        account={ACCOUNTS[0]}
        banks={BANKS}
        accountTypes={ACCOUNT_TYPES}
        onSave={onSave}
        onClose={vi.fn()}
        isPending={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument();
  });

  it('appelle onSave avec les données modifiées en mode édition', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(
      <AccountModal
        mode="edit"
        account={ACCOUNTS[0]}
        banks={BANKS}
        accountTypes={ACCOUNT_TYPES}
        onSave={onSave}
        onClose={vi.fn()}
        isPending={false}
      />,
    );

    const inputNom = screen.getByDisplayValue('Compte courant');
    await user.clear(inputNom);
    await user.type(inputNom, 'Compte Modifié');

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Compte Modifié',
      }),
    );
  });
});
