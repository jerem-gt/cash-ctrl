import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ScheduledRow } from '@/features/scheduled/components/ScheduledRow';
import { SCHEDULED } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import type { ScheduledTransaction } from '@/types';

const baseSched = SCHEDULED[0];
const accounts = [
  { id: 1, name: 'Compte courant' },
  { id: 2, name: 'Livret A' },
];

function renderRow(
  sched: ScheduledTransaction,
  callbacks?: Partial<Parameters<typeof ScheduledRow>[0]>,
) {
  return renderWithProviders(
    <ScheduledRow
      sched={sched}
      accounts={accounts}
      onEdit={callbacks?.onEdit ?? vi.fn()}
      onDelete={callbacks?.onDelete ?? vi.fn()}
      onViewTransactions={callbacks?.onViewTransactions ?? vi.fn()}
    />,
  );
}

describe('ScheduledRow', () => {
  it('affiche la description et le label de récurrence mensuelle', () => {
    renderRow(baseSched);
    expect(screen.getByText('Loyer')).toBeInTheDocument();
    expect(screen.getByText(/chaque mois/i)).toBeInTheDocument();
  });

  it(`affiche le badge "Suspendu" pour une planification inactive`, () => {
    renderRow({ ...baseSched, active: 0 });
    expect(screen.getByText('Suspendu')).toBeInTheDocument();
  });

  it(`affiche le badge "Transfert" pour un virement planifié`, () => {
    renderRow({ ...baseSched, payment_method: 'Transfert', to_account_id: 2 });
    expect(screen.getByText(/↔ Transfert/)).toBeInTheDocument();
  });

  it('affiche la date de fin si renseignée', () => {
    renderRow({ ...baseSched, end_date: '2026-12-31' });
    expect(screen.getByText(/jusqu'au 2026-12-31/)).toBeInTheDocument();
  });

  it('affiche le compte destination pour un transfert connu', () => {
    renderRow({ ...baseSched, payment_method: 'Transfert', to_account_id: 2 });
    expect(screen.getByText(/→ Livret A/)).toBeInTheDocument();
  });

  it('affiche le badge "N tx" quand transaction_count > 0', () => {
    renderRow(baseSched); // transaction_count = 3
    expect(screen.getByRole('button', { name: '3 tx' })).toBeInTheDocument();
  });

  it('appelle onViewTransactions au clic sur le badge tx', () => {
    const onViewTransactions = vi.fn();
    renderRow(baseSched, { onViewTransactions });
    fireEvent.click(screen.getByRole('button', { name: '3 tx' }));
    expect(onViewTransactions).toHaveBeenCalledWith(baseSched);
  });

  it("n'affiche pas le badge tx quand transaction_count === 0", () => {
    renderRow({ ...baseSched, transaction_count: 0 });
    expect(screen.queryByRole('button', { name: /tx$/ })).not.toBeInTheDocument();
  });

  it('appelle onEdit au clic sur Modifier', () => {
    const onEdit = vi.fn();
    renderRow(baseSched, { onEdit });
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(onEdit).toHaveBeenCalledWith(baseSched);
  });

  it('appelle onDelete au clic sur Supprimer', () => {
    const onDelete = vi.fn();
    renderRow(baseSched, { onDelete });
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(onDelete).toHaveBeenCalledWith(baseSched);
  });
});
