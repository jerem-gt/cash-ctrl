import type { Account, Transaction } from '@/types';
import { fmtDate, fmtDec } from '@/lib/format';
import { AccountBadge } from '@/components/AccountBadge';
import { useValidateTransaction } from '@/hooks/useTransactions';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';

interface Props {
  tx: Transaction;
  accounts?: Account[];
  logoMap?: Record<string, string | null>;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

export function TxItem({ tx, accounts, logoMap, onEdit, onDelete }: Readonly<Props>) {
  const isTransfer = tx.transfer_peer_id !== null;
  const validated = !!tx.validated;
  const account = accounts?.find(a => a.id === tx.account_id);
  const logo = account?.bank ? (logoMap?.[account.bank] ?? null) : null;
  const validate = useValidateTransaction();
  const { data: paymentMethods = [] } = usePaymentMethods();

  const pmIcon = tx.payment_method
    ? (paymentMethods.find(m => m.name === tx.payment_method)?.icon ?? '')
    : '';

  return (
    <div
      title={tx.notes || undefined}
      className={`flex items-center gap-3 px-4 py-3 bg-white border rounded-xl transition-colors ${validated ? 'border-green-200 hover:border-green-300' : 'border-black/[0.07] hover:border-black/[0.13]'}`}
    >
      <span className="text-base leading-none shrink-0 w-4 text-center">{pmIcon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${validated ? 'text-stone-400' : ''}`}>{tx.description}</p>
          {isTransfer && (
            <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 font-medium shrink-0">
              ↔ Transfert
            </span>
          )}
          {validated && (
            <span className="text-[10px] bg-green-50 text-green-600 border border-green-200 rounded px-1.5 py-0.5 font-medium shrink-0">
              ✓ Validée
            </span>
          )}
        </div>
        <p className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-1 flex-wrap">
          <span>{tx.category} ·</span>
          {accounts && logoMap
            ? <AccountBadge name={tx.account_name ?? ''} bank={account?.bank} logo={logo} />
            : null}
          {accounts && logoMap && <span>·</span>}
          <span>{fmtDate(tx.date)}</span>
          {tx.payment_method && <><span>·</span><span>{tx.payment_method}</span></>}
        </p>
      </div>
      <span className={`text-sm font-medium tabular-nums ${validated ? 'text-stone-400' : tx.type === 'income' ? 'text-green-800' : 'text-red-700'}`}>
        {tx.type === 'income' ? '+' : '−'}{fmtDec(tx.amount)}
      </span>
      <button
        onClick={() => validate.mutate({ id: tx.id, validated: !validated })}
        disabled={validate.isPending}
        className={`transition-colors text-base leading-none px-1 ${validated ? 'text-green-500 hover:text-stone-400' : 'text-stone-300 hover:text-green-500'}`}
        title={validated ? 'Marquer comme non validée' : 'Valider'}
      >✓</button>
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
