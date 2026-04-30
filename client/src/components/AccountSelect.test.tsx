import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ACCOUNTS } from '@/tests/fixtures';

import { AccountSelect } from './AccountSelect';

const logoMap: Record<string, string | null> = { BNP: null };

describe('AccountSelect', () => {
  it('affiche le placeholder par défaut', () => {
    render(
      <AccountSelect
        id="account-select"
        value=""
        onChange={vi.fn()}
        accounts={ACCOUNTS}
        logoMap={logoMap}
      />,
    );
    expect(screen.getByText('— Choisir —')).toBeInTheDocument();
  });

  it('affiche le placeholder personnalisé', () => {
    render(
      <AccountSelect
        id="account-select"
        value=""
        onChange={vi.fn()}
        accounts={ACCOUNTS}
        logoMap={logoMap}
        placeholder="Tous les comptes"
      />,
    );
    expect(screen.getByText('Tous les comptes')).toBeInTheDocument();
  });

  it('affiche le compte sélectionné', () => {
    render(
      <AccountSelect
        id="account-select"
        value="1"
        onChange={vi.fn()}
        accounts={ACCOUNTS}
        logoMap={logoMap}
      />,
    );
    expect(screen.getByText('Compte test')).toBeInTheDocument();
  });

  it('ouvre la liste au clic', async () => {
    const user = userEvent.setup();
    render(
      <AccountSelect
        id="account-select"
        value=""
        onChange={vi.fn()}
        accounts={ACCOUNTS}
        logoMap={logoMap}
      />,
    );
    await user.click(document.getElementById('account-select')!);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('appelle onChange lors de la sélection', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <AccountSelect
        id="account-select"
        value=""
        onChange={onChange}
        accounts={ACCOUNTS}
        logoMap={logoMap}
      />,
    );
    await user.click(document.getElementById('account-select')!);
    const options = screen.getAllByRole('option');
    await user.click(options[1]); // premier vrai compte
    expect(onChange).toHaveBeenCalledWith('1');
  });

  it("n'affiche pas la recherche pour ≤ 5 comptes", async () => {
    const user = userEvent.setup();
    render(
      <AccountSelect
        id="account-select"
        value=""
        onChange={vi.fn()}
        accounts={ACCOUNTS}
        logoMap={logoMap}
      />,
    );
    await user.click(document.getElementById('account-select')!);
    expect(screen.queryByPlaceholderText('Rechercher…')).not.toBeInTheDocument();
  });

  it('affiche la recherche pour > 5 comptes', async () => {
    const manyAccounts = Array.from({ length: 6 }, (_, i) => ({
      ...ACCOUNTS[0],
      id: i + 1,
      name: `Compte ${i + 1}`,
    }));
    const user = userEvent.setup();
    render(
      <AccountSelect
        id="account-select"
        value=""
        onChange={vi.fn()}
        accounts={manyAccounts}
        logoMap={logoMap}
      />,
    );
    await user.click(document.getElementById('account-select')!);
    expect(screen.getByPlaceholderText('Rechercher…')).toBeInTheDocument();
  });

  it('filtre les comptes par recherche', async () => {
    const manyAccounts = [
      ...ACCOUNTS,
      { ...ACCOUNTS[0], id: 2, name: 'Épargne' },
      { ...ACCOUNTS[0], id: 3, name: 'PEA' },
      { ...ACCOUNTS[0], id: 4, name: 'Livret' },
      { ...ACCOUNTS[0], id: 5, name: 'Pro' },
      { ...ACCOUNTS[0], id: 6, name: 'Joint' },
    ];
    const user = userEvent.setup();
    render(
      <AccountSelect
        id="account-select"
        value=""
        onChange={vi.fn()}
        accounts={manyAccounts}
        logoMap={logoMap}
      />,
    );
    await user.click(document.getElementById('account-select')!);
    await user.type(screen.getByPlaceholderText('Rechercher…'), 'épargne');
    expect(screen.getByRole('option', { name: /épargne/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /PEA/i })).not.toBeInTheDocument();
  });

  it('affiche "Aucun résultat" si la recherche ne correspond à rien', async () => {
    const manyAccounts = Array.from({ length: 6 }, (_, i) => ({
      ...ACCOUNTS[0],
      id: i + 1,
      name: `Compte ${i + 1}`,
    }));
    const user = userEvent.setup();
    render(
      <AccountSelect
        id="account-select"
        value=""
        onChange={vi.fn()}
        accounts={manyAccounts}
        logoMap={logoMap}
      />,
    );
    await user.click(document.getElementById('account-select')!);
    await user.type(screen.getByPlaceholderText('Rechercher…'), 'zzz_introuvable');
    expect(screen.getByText('Aucun résultat')).toBeInTheDocument();
  });

  it('gère la navigation au clavier (Flèches et Entrée)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    // 6 comptes pour activer le champ recherche (showSearch = true)
    const manyAccounts = Array.from({ length: 6 }, (_, i) => ({
      ...ACCOUNTS[0],
      id: i + 1,
      name: `Compte ${i + 1}`,
    }));

    render(
      <AccountSelect
        id="keyboard-test"
        value=""
        onChange={onChange}
        accounts={manyAccounts}
        logoMap={logoMap}
      />,
    );

    const trigger = document.getElementById('keyboard-test')!;

    // 1. Ouvrir le menu
    await user.click(trigger);

    // 2. Vérifier que l'input a le focus automatiquement (Ligne 116 du composant)
    const searchInput = screen.getByPlaceholderText('Rechercher…');
    await waitFor(() => expect(searchInput).toHaveFocus());

    // 3. Appuyer sur ArrowDown pour quitter l'input et aller sur "— Choisir —"
    await user.keyboard('{ArrowDown}');

    const options = screen.getAllByRole('option');
    // L'option "— Choisir —" est à l'index 0
    expect(options[0]).toHaveFocus();

    // 4. Descendre sur le premier vrai compte
    await user.keyboard('{ArrowDown}');
    expect(options[1]).toHaveFocus();

    // 5. Remonter sur "— Choisir —" (Ligne 124)
    await user.keyboard('{ArrowUp}');
    expect(options[0]).toHaveFocus();

    // 6. Sélectionner
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('gère les touches spécifiques (Espace, Tab, Escape)', async () => {
    const user = userEvent.setup();
    render(
      <AccountSelect id="test" value="" onChange={vi.fn()} accounts={ACCOUNTS} logoMap={logoMap} />,
    );
    const trigger = document.getElementById('test')!;

    // Test Escape pour fermer
    await user.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Test Espace pour ouvrir
    trigger.focus();
    await user.keyboard(' ');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});
