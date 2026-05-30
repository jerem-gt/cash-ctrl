import type React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ModalFrame, Skeleton } from '@/components/ui';
import { useTransactions } from '@/hooks/useTransactions';
import { fmtDate, fmtDec } from '@/lib/format';
import type { ScheduledTransaction } from '@/types';

interface ScheduledTxModalProps {
  sched: ScheduledTransaction;
  onClose: () => void;
}

export function ScheduledTxModal({ sched, onClose }: Readonly<ScheduledTxModalProps>) {
  const { t } = useTranslation('scheduled');
  const { t: tc } = useTranslation('common');
  const { data, isLoading } = useTransactions({ scheduled_id: sched.id, limit: 200 });
  const transactions = data?.data ?? [];

  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  } else if (transactions.length === 0) {
    content = <p className="text-sm text-stone-400 py-2">{t('tx_modal.no_transactions')}</p>;
  } else {
    content = (
      <div className="divide-y divide-black/6">
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center gap-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-stone-400">{fmtDate(tx.date)}</p>
              <p className="text-sm text-stone-700 truncate">{tx.description}</p>
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                tx.validated
                  ? 'bg-green-50 text-green-600 border border-green-200'
                  : 'bg-amber-50 text-amber-600 border border-amber-200'
              }`}
            >
              {tx.validated ? t('tx_modal.validated') : t('tx_modal.pending')}
            </span>
            <span
              className={`text-sm font-medium tabular-nums shrink-0 ${
                tx.type === 'income' ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {tx.type === 'income' ? '+' : '−'}
              {fmtDec(tx.amount)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <ModalFrame
      title={sched.description}
      subtitle={t('tx_modal.subtitle')}
      size="lg"
      onClose={onClose}
      footer={
        <Button type="button" onClick={onClose}>
          {tc('close')}
        </Button>
      }
    >
      {content}
    </ModalFrame>
  );
}
