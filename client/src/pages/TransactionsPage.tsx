import { useMemo } from 'react';

import { TransactionsList } from '@/components/TransactionsList';
import { useBanks } from '@/hooks/useBanks.ts';

export default function TransactionsPage() {
  const { data: banks = [] } = useBanks();
  const logoMap = useMemo(() => Object.fromEntries(banks.map((b) => [b.name, b.logo])), [banks]);

  return (
    <div className="space-y-5">
      {/* List */}
      <TransactionsList logoMap={logoMap} />
    </div>
  );
}
