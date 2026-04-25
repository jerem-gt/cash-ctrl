import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TRANSACTIONS } from '@/tests/fixtures';
import type { Transaction } from '@/types';

import { DeleteTxModal } from './DeleteTxModal';

const baseTx = TRANSACTIONS.data[0];
const transferTx: Transaction = { ...baseTx, transfer_peer_id: 42 };

describe('DeleteTxModal', () => {
  it('affiche "Supprimer la transaction" pour une transaction classique', () => {
    render(<DeleteTxModal tx={baseTx} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Supprimer la transaction')).toBeInTheDocument();
    expect(screen.getByText(/irréversible. Confirmer/i)).toBeInTheDocument();
  });

  it('affiche "Supprimer le transfert" pour un transfert', () => {
    render(<DeleteTxModal tx={transferTx} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Supprimer le transfert')).toBeInTheDocument();
    expect(screen.getByText(/deux côtés/i)).toBeInTheDocument();
  });

  it('appelle onConfirm au clic sur Confirmer', async () => {
    const onConfirm = vi.fn();
    const { getByRole } = render(
      <DeleteTxModal tx={baseTx} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    getByRole('button', { name: 'Confirmer' }).click();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('appelle onCancel au clic sur Annuler', () => {
    const onCancel = vi.fn();
    const { getByRole } = render(
      <DeleteTxModal tx={baseTx} onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    getByRole('button', { name: 'Annuler' }).click();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
