import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ACCOUNTS, CATEGORIES, PAYMENT_METHODS } from '@/tests/fixtures';

import type { TxCoreState } from './TxCoreFields';
import { TxCoreFields } from './TxCoreFields';

const logoMap: Record<string, string | null> = { BNP: null, LCL: null };

const defaultValue: TxCoreState = {
  type: 'expense',
  amount: '',
  description: '',
  category_id: '',
  subcategory_id: '',
  account_id: '',
  to_account_id: '',
  payment_method_id: '',
};

const defaultProps = {
  value: defaultValue,
  onChange: vi.fn(),
  accounts: ACCOUNTS,
  logoMap,
  categories: CATEGORIES,
  paymentMethods: PAYMENT_METHODS,
  isTransfer: false,
};

describe('TxCoreFields', () => {
  it('affiche les champs montant et description', () => {
    render(<TxCoreFields {...defaultProps} />);
    expect(screen.getByPlaceholderText('0,00')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex : Courses Leclerc')).toBeInTheDocument();
  });

  it('affiche le sélecteur type (Dépense/Revenu) en mode transaction', () => {
    render(<TxCoreFields {...defaultProps} />);
    expect(screen.getByText('Dépense')).toBeInTheDocument();
    expect(screen.getByText('Revenu')).toBeInTheDocument();
  });

  it('affiche les catégories et moyens de paiement en mode transaction', () => {
    render(<TxCoreFields {...defaultProps} />);
    expect(screen.getByText('Alimentation')).toBeInTheDocument();
    expect(screen.getByText(/CB/)).toBeInTheDocument();
  });

  it('masque type, catégorie et moyen de paiement en mode transfert', () => {
    render(<TxCoreFields {...defaultProps} isTransfer />);
    expect(screen.queryByText('Dépense')).not.toBeInTheDocument();
    expect(screen.queryByText('Alimentation')).not.toBeInTheDocument();
    expect(screen.queryByText(/CB/)).not.toBeInTheDocument();
  });

  it('affiche le sélecteur de compte destination en mode transfert', () => {
    render(<TxCoreFields {...defaultProps} isTransfer />);
    expect(screen.getByText('Compte destination')).toBeInTheDocument();
  });

  it('masque le sélecteur de compte source si fixedAccountId est fourni', () => {
    render(<TxCoreFields {...defaultProps} fixedAccountId={1} />);
    expect(screen.queryByText('Compte')).not.toBeInTheDocument();
  });

  it('appelle onChange lors de la saisie du montant', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TxCoreFields {...defaultProps} onChange={onChange} />);
    await user.type(screen.getByPlaceholderText('0,00'), '50');
    expect(onChange).toHaveBeenCalled();
  });

  it('appelle onChange lors de la saisie de la description', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TxCoreFields {...defaultProps} onChange={onChange} />);
    await user.type(screen.getByPlaceholderText('Ex : Courses Leclerc'), 'Marché');
    expect(onChange).toHaveBeenCalled();
  });

  it('handleSourceChange en mode simple appelle onChange avec account_id', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TxCoreFields {...defaultProps} onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: /choisir/i });
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: /Compte test/i }));
    expect(onChange).toHaveBeenCalledWith({ account_id: '1' });
  });

  it('handleDestChange en mode transfert appelle onChange avec to_account_id et description', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TxCoreFields
        {...defaultProps}
        onChange={onChange}
        isTransfer
        value={{ ...defaultValue, account_id: '1' }}
      />,
    );
    // Source sélectionné = "Compte courant" ; destination affiche "— Choisir —"
    const destTrigger = screen.getByRole('button', { name: /choisir/i });
    await user.click(destTrigger);
    await user.click(await screen.findByRole('option', { name: /Livret A/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ to_account_id: '2' }));
  });

  it('description utilise les noms de banques différentes (BNP → LCL)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TxCoreFields
        {...defaultProps}
        onChange={onChange}
        logoMap={logoMap}
        isTransfer
        value={{ ...defaultValue, account_id: '1' }}
      />,
    );
    document.getElementById('account-select')!;
    const destTrigger = screen.getByRole('button', { name: /choisir/i });
    await user.click(destTrigger);
    await user.click(await screen.findByRole('option', { name: /Livret A/i }));
    // ACCOUNTS[0].bank = 'BNP', ACCOUNT_B.bank = 'LCL' → description = 'BNP → LCL'
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ description: 'BNP → LCL' }));
  });

  it('handleSourceChange en mode transfert met à jour account_id', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TxCoreFields
        {...defaultProps}
        onChange={onChange}
        isTransfer
        value={{ ...defaultValue, account_id: '' }}
      />,
    );
    // Les deux AccountSelect affichent "— Choisir —"
    const triggers = screen.getAllByRole('button', { name: /choisir/i });
    // Premier = source
    await user.click(triggers[0]);
    await user.click(await screen.findByRole('option', { name: /Compte test/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ account_id: '1' }));
  });
});
