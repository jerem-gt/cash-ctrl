import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { ACCOUNTS, BANKS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import type { TxCoreState } from './TxCoreFields';

let TxTransferFields: typeof import('./TxTransferFields').TxTransferFields;

beforeAll(async () => {
  vi.doMock('@/hooks/useBanks', () => ({
    useBanks: () => ({ data: BANKS }),
  }));
  vi.resetModules();
  ({ TxTransferFields } = await import('./TxTransferFields'));
});

afterAll(() => {
  vi.doUnmock('@/hooks/useBanks');
  vi.resetModules();
});

const logoMap: Record<string, string | null> = {};

const core: TxCoreState = {
  type: 'income',
  amount: '100',
  description: 'Virement test',
  category_id: '',
  subcategory_id: '',
  account_id: String(ACCOUNTS[0].id),
  to_account_id: String(ACCOUNTS[1].id),
  payment_method_id: '',
};

function renderFields(onPatch = vi.fn()) {
  return renderWithProviders(
    <TxTransferFields core={core} onPatch={onPatch} accounts={ACCOUNTS} logoMap={logoMap} />,
  );
}

describe('TxTransferFields', () => {
  it('affiche les labels Montant, Description, Compte source et Compte destination', () => {
    renderFields();
    expect(screen.getByText('Montant (€)')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Compte source')).toBeInTheDocument();
    expect(screen.getByText('Compte destination')).toBeInTheDocument();
  });

  it('affiche la valeur initiale du montant', () => {
    renderFields();
    expect(screen.getByPlaceholderText('0,00')).toHaveValue('100');
  });

  it('appelle onPatch avec le nouveau montant à la saisie', async () => {
    const user = userEvent.setup();
    const onPatch = vi.fn();
    renderFields(onPatch);
    const input = screen.getByPlaceholderText('0,00');
    await user.clear(input);
    await user.type(input, '250');
    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({ amount: expect.any(String) }));
  });

  it('appelle onPatch avec la nouvelle description à la saisie', async () => {
    const user = userEvent.setup();
    const onPatch = vi.fn();
    renderFields(onPatch);
    const input = screen.getByPlaceholderText('Ex : Virement');
    await user.clear(input);
    await user.type(input, 'Nouveau virement');
    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.any(String) }),
    );
  });

  it('affiche le nom du compte source sélectionné', () => {
    renderFields();
    expect(screen.getByText(ACCOUNTS[0].name)).toBeInTheDocument();
  });
});
