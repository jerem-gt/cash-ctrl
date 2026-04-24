import { TxItem } from '@/components/TxItem';
import { Empty, Skeleton } from '@/components/ui';
import type { Account, Transaction } from '@/types';

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
  if (isLoading) return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border rounded-xl border-black/[0.07] bg-white">
          <Skeleton className="w-4 h-4 shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-2/5" />
          </div>
          <Skeleton className="w-14 h-3.5 shrink-0" />
        </div>
      ))}
    </div>
  );
  if (transactions.length === 0) return <Empty>{emptyMessage}</Empty>;

  return (
    <div className="flex flex-col gap-2">
      {transactions.map(t => (
        <TxItem key={t.id} tx={t} accounts={accounts} logoMap={logoMap} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
