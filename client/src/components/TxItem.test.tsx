import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TRANSACTIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import type { Transaction } from '@/types';

import { TxItem } from './TxItem';

const baseTx = TRANSACTIONS.data[0]; // validated expense
const noop = vi.fn();

function renderTx(tx: Transaction) {
  return renderWithProviders(<TxItem tx={tx} onEdit={noop} onDelete={noop} onDuplicate={noop} />);
}

describe('TxItem', () => {
  it('affiche la description', () => {
    renderTx(baseTx);
    expect(screen.getByText('Courses')).toBeInTheDocument();
  });

  it('affiche le montant en négatif pour une dépense', () => {
    renderTx(baseTx);
    expect(screen.getByText(/24,50/)).toBeInTheDocument();
  });

  it('affiche le badge "Validée" si la transaction est validée', () => {
    renderTx(baseTx);
    expect(screen.getByText(/validée/i)).toBeInTheDocument();
  });

  it('affiche le badge "Transfert" si transfer_peer_id est renseigné', () => {
    const transferTx: Transaction = { ...baseTx, transfer_peer_id: 42, validated: 0 };
    renderTx(transferTx);
    expect(screen.getByText(/transfert/i)).toBeInTheDocument();
  });

  it('affiche le badge "À venir" pour une transaction planifiée future', () => {
    const futureTx: Transaction = {
      ...baseTx,
      scheduled_id: 5,
      date: '2030-01-01',
      validated: 0,
      transfer_peer_id: null,
    };
    renderTx(futureTx);
    expect(screen.getByText(/à venir/i)).toBeInTheDocument();
  });

  it('affiche le bouton de validation', () => {
    renderTx(baseTx);
    expect(screen.getByTitle(/marquer comme non validée/i)).toBeInTheDocument();
  });

  it('affiche les boutons modifier, dupliquer et supprimer', () => {
    renderTx(baseTx);
    expect(screen.getByTitle('Modifier')).toBeInTheDocument();
    expect(screen.getByTitle('Dupliquer')).toBeInTheDocument();
  });

  it("n'affiche pas les boutons optionnels si callbacks absents", () => {
    renderWithProviders(<TxItem tx={baseTx} />);
    expect(screen.queryByTitle('Modifier')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Dupliquer')).not.toBeInTheDocument();
  });
});
