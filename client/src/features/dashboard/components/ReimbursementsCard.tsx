import { useTranslation } from 'react-i18next';

import { Card, CardTitle } from '@/components/ui';
import { useSetReimbursementStatus } from '@/features/transactions/hooks/useReimbursements';
import { fmtDate, fmtDec } from '@/lib/format';
import type { PendingReimbursement } from '@/types';

interface RowProps {
  item: PendingReimbursement;
  /** Quand fourni : ligne active avec bouton "✓" pour marquer comme remboursé. */
  onMarkDone?: (id: number) => void;
  pendingMutation?: boolean;
  /** Style "fade" pour les remboursements déjà terminés. */
  faded?: boolean;
  markDoneTitle?: string;
}

function Row({ item, onMarkDone, pendingMutation, faded, markDoneTitle }: Readonly<RowProps>) {
  const remaining = item.amount - item.total_reimbursed;
  const remainingColor = remaining > 0 ? 'text-danger' : 'text-success';
  const amountColor = faded ? 'text-content-muted' : 'text-danger';
  return (
    <tr className={faded ? 'opacity-60' : 'group'}>
      <td className="py-2 pr-3">
        <p className="font-medium text-content-secondary truncate max-w-40">{item.description}</p>
        <p className="text-content-subtle text-[10px]">
          {item.subcategory || item.category} · {item.account_name}
        </p>
      </td>
      <td className="py-2 pr-3 text-content-muted hidden sm:table-cell whitespace-nowrap">
        {fmtDate(item.date)}
      </td>
      <td
        className={`py-2 pr-3 text-right tabular-nums font-medium whitespace-nowrap ${amountColor}`}
      >
        −{fmtDec(item.amount)}
      </td>
      <td className="py-2 pr-3 text-right text-success tabular-nums hidden sm:table-cell whitespace-nowrap">
        {item.total_reimbursed > 0 ? `+${fmtDec(item.total_reimbursed)}` : '—'}
      </td>
      <td className="py-2 pr-3 text-right tabular-nums font-medium whitespace-nowrap">
        <span className={remainingColor}>{fmtDec(Math.max(0, remaining))}</span>
      </td>
      <td className="py-2 text-right">
        {onMarkDone && (
          <button
            type="button"
            onClick={() => onMarkDone(item.id)}
            disabled={pendingMutation}
            title={markDoneTitle}
            className="text-content-faint hover:text-success transition-colors text-base leading-none opacity-0 group-hover:opacity-100"
          >
            ✓
          </button>
        )}
      </td>
    </tr>
  );
}

interface Props {
  pending: PendingReimbursement[];
  recent: PendingReimbursement[];
}

export function ReimbursementsCard({ pending, recent }: Readonly<Props>) {
  const { t } = useTranslation('dashboard');
  const setStatus = useSetReimbursementStatus();
  const handleMarkDone = (id: number) => setStatus.mutate({ id, status: 'rembourse' });

  return (
    <Card>
      <CardTitle>{t('reimbursements_title')}</CardTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-120 text-xs">
          <thead>
            <tr className="text-content-subtle text-[10px] uppercase tracking-wider">
              <th className="text-left pb-2 font-medium">{t('reimb_col_description')}</th>
              <th className="text-left pb-2 font-medium hidden sm:table-cell">
                {t('reimb_col_date')}
              </th>
              <th className="text-right pb-2 font-medium">{t('reimb_col_expense')}</th>
              <th className="text-right pb-2 font-medium hidden sm:table-cell">
                {t('reimb_col_reimbursed')}
              </th>
              <th className="text-right pb-2 font-medium">{t('reimb_col_remaining')}</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {pending.length > 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="pt-1 pb-1 text-[10px] font-medium uppercase tracking-widest text-warning"
                >
                  {t('reimb_pending_section')}
                </td>
              </tr>
            )}
            {pending.map((item) => (
              <Row
                key={item.id}
                item={item}
                onMarkDone={handleMarkDone}
                pendingMutation={setStatus.isPending}
                markDoneTitle={t('reimb_mark_done_title')}
              />
            ))}
            {recent.length > 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="pt-4 pb-1 text-[10px] font-medium uppercase tracking-widest text-success"
                >
                  {t('reimb_done_section')}
                </td>
              </tr>
            )}
            {recent.map((item) => (
              <Row key={item.id} item={item} faded />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
