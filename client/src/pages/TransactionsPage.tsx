import { TransactionsList } from '@/features/transactions/components/TransactionsList';
import { useLogoMap } from '@/hooks/useLogoMap';

export default function TransactionsPage() {
  const logoMap = useLogoMap();

  return (
    <div className="space-y-5">
      {/* List */}
      <TransactionsList logoMap={logoMap} />
    </div>
  );
}
