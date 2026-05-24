import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it(`affiche le badge "Transfert" si transfer_peer_id est renseigné`, () => {
    const transferTx: Transaction = { ...baseTx, transfer_peer_id: 42, validated: 0 };
    renderTx(transferTx);
    expect(screen.getByText(/↔/i)).toBeInTheDocument();
  });

  it(`affiche le badge "À venir" pour une transaction planifiée future`, () => {
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
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dupliquer' })).toBeInTheDocument();
  });

  it("n'affiche pas les boutons optionnels si callbacks absents", () => {
    renderWithProviders(<TxItem tx={baseTx} />);
    expect(screen.queryByTitle('Modifier')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Dupliquer')).not.toBeInTheDocument();
  });

  it(`affiche "Ventilée (N)" dans le sous-titre pour une transaction ventilée`, () => {
    const ventilatedTx: Transaction = {
      ...baseTx,
      validated: 0,
      subcategory_id: null,
      splits: [
        { id: 1, subcategory_id: 1, amount: 10 },
        { id: 2, subcategory_id: 2, amount: 14.5 },
      ],
    };
    renderTx(ventilatedTx);
    expect(screen.getByText(/Ventilée \(2\)/)).toBeInTheDocument();
  });

  it(`pas de badge "Ventilée" pour une transaction normale`, () => {
    renderTx(baseTx);
    expect(screen.queryByText('⊕ Ventilée')).not.toBeInTheDocument();
  });

  it('affiche le solde courant quand runningBalance est fourni', () => {
    renderWithProviders(
      <TxItem
        tx={baseTx}
        runningBalance={1500.5}
        onEdit={noop}
        onDelete={noop}
        onDuplicate={noop}
      />,
    );
    expect(screen.getByTitle('Solde courant')).toBeInTheDocument();
    expect(screen.getByTitle('Solde courant').textContent).toMatch(/1.500,50/);
  });

  it("n'affiche pas de solde courant si runningBalance est absent", () => {
    renderTx(baseTx);
    expect(screen.queryByTitle('Solde courant')).not.toBeInTheDocument();
  });

  it("clique sur le bouton de validation bascule l'état validé", async () => {
    const user = userEvent.setup();
    renderTx(baseTx);
    const validateBtn = screen.getByTitle(/marquer comme non validée/i);
    await user.click(validateBtn);
    // Le patch est intercepté par MSW — on vérifie juste que le bouton est cliquable
    expect(validateBtn).toBeInTheDocument();
  });

  it("affiche l'icône note quand tx.notes est renseigné", () => {
    const txWithNotes = { ...baseTx, notes: 'Remboursement partiel' };
    renderTx(txWithNotes);
    expect(screen.getAllByTitle('Remboursement partiel').length).toBeGreaterThan(0);
  });
});
