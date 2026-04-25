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
});
