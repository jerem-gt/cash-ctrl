import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ACCOUNTS } from '@/tests/fixtures';

import { AccountSelect } from './AccountSelect';

const logoMap: Record<string, string | null> = { BNP: null };

describe('AccountSelect', () => {
  it('affiche le placeholder par défaut', () => {
    render(<AccountSelect value="" onChange={vi.fn()} accounts={ACCOUNTS} logoMap={logoMap} />);
    expect(screen.getByText('— Choisir —')).toBeInTheDocument();
  });

  it('affiche le placeholder personnalisé', () => {
    render(
      <AccountSelect
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
    render(<AccountSelect value="1" onChange={vi.fn()} accounts={ACCOUNTS} logoMap={logoMap} />);
    expect(screen.getByText('Compte courant')).toBeInTheDocument();
  });

  it('ouvre la liste au clic', async () => {
    const user = userEvent.setup();
    render(<AccountSelect value="" onChange={vi.fn()} accounts={ACCOUNTS} logoMap={logoMap} />);
    await user.click(screen.getByRole('button', { name: /choisir/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('appelle onChange lors de la sélection', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AccountSelect value="" onChange={onChange} accounts={ACCOUNTS} logoMap={logoMap} />);
    await user.click(screen.getByRole('button', { name: /choisir/i }));
    const options = screen.getAllByRole('option');
    await user.click(options[1]); // premier vrai compte
    expect(onChange).toHaveBeenCalledWith('1');
  });

  it("n'affiche pas la recherche pour ≤ 5 comptes", async () => {
    const user = userEvent.setup();
    render(<AccountSelect value="" onChange={vi.fn()} accounts={ACCOUNTS} logoMap={logoMap} />);
    await user.click(screen.getByRole('button', { name: /choisir/i }));
    expect(screen.queryByPlaceholderText('Rechercher…')).not.toBeInTheDocument();
  });

  it('affiche la recherche pour > 5 comptes', async () => {
    const manyAccounts = Array.from({ length: 6 }, (_, i) => ({
      ...ACCOUNTS[0],
      id: i + 1,
      name: `Compte ${i + 1}`,
    }));
    const user = userEvent.setup();
    render(<AccountSelect value="" onChange={vi.fn()} accounts={manyAccounts} logoMap={logoMap} />);
    await user.click(screen.getByRole('button', { name: /choisir/i }));
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
    render(<AccountSelect value="" onChange={vi.fn()} accounts={manyAccounts} logoMap={logoMap} />);
    await user.click(screen.getByRole('button', { name: /choisir/i }));
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
    render(<AccountSelect value="" onChange={vi.fn()} accounts={manyAccounts} logoMap={logoMap} />);
    await user.click(screen.getByRole('button', { name: /choisir/i }));
    await user.type(screen.getByPlaceholderText('Rechercher…'), 'zzz_introuvable');
    expect(screen.getByText('Aucun résultat')).toBeInTheDocument();
  });
});
