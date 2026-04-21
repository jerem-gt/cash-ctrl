import type { Account, Transaction } from '@/types';
import { Empty } from '@/components/ui';
import { TxItem } from '@/components/TxItem';

interface Props {
  isLoading: boolean;
  transactions: Transaction[];
  accounts?: Account[];
  logoMap?: Record<string, string | null>;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  emptyMessage?: string;
}

export function TransactionsList({ isLoading, transactions, accounts, logoMap, onEdit, onDelete, emptyMessage = 'Aucune transaction trouvée' }: Readonly<Props>) {
  if (isLoading) return <p className="text-sm text-stone-400">Chargement…</p>;
  if (transactions.length === 0) return <Empty>{emptyMessage}</Empty>;

  return (
    <div className="flex flex-col gap-2">
      {transactions.map(t => (
        <TxItem key={t.id} tx={t} accounts={accounts} logoMap={logoMap} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
