import type { Account, Bank, Transaction } from '@/types';
import { fmtDate, fmtDec } from '@/lib/format';
import { AccountBadge } from '@/components/AccountBadge';

interface Props {
  tx: Transaction;
  accounts?: Account[];
  banks?: Bank[];
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

export function TxItem({ tx, accounts, banks, onEdit, onDelete }: Readonly<Props>) {
  const isTransfer = tx.transfer_peer_id !== null;
  const account = accounts?.find(a => a.id === tx.account_id);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border border-black/[0.07] rounded-xl hover:border-black/[0.13] transition-colors">
      <div className={`w-2 h-2 rounded-full shrink-0 ${tx.type === 'income' ? 'bg-green-500' : 'bg-red-400'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{tx.description}</p>
          {isTransfer && (
            <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 font-medium shrink-0">
              ↔ Transfert
            </span>
          )}
        </div>
        <p className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-1 flex-wrap">
          <span>{tx.category} ·</span>
          {accounts && banks
            ? <AccountBadge name={tx.account_name} bank={account?.bank} banks={banks} />
            : null}
          {accounts && banks && <span>·</span>}
          <span>{fmtDate(tx.date)}</span>
        </p>
      </div>
      <span className={`text-sm font-medium tabular-nums ${tx.type === 'income' ? 'text-green-800' : 'text-red-700'}`}>
        {tx.type === 'income' ? '+' : '−'}{fmtDec(tx.amount)}
      </span>
      <button
        onClick={() => onEdit(tx)}
        className="text-stone-300 hover:text-stone-600 transition-colors text-sm leading-none px-1"
        title="Modifier"
      >✎</button>
      <button
        onClick={() => onDelete(tx)}
        className="text-stone-300 hover:text-red-400 transition-colors text-lg leading-none px-1"
      >×</button>
    </div>
  );
}
