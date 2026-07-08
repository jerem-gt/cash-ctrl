import { useLocation, useSearchParams } from 'react-router-dom';

import { TransactionsList } from '@/features/transactions/components/TransactionsList';
import { useLogoMap } from '@/hooks/useLogoMap';

export default function TransactionsPage() {
  const logoMap = useLogoMap();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const q = searchParams.get('q') ?? undefined;

  return (
    <div className="space-y-5">
      {/* List */}
      <TransactionsList
        logoMap={logoMap}
        initialFilters={{ description_contains: q }}
        resyncKey={location.key}
      />
    </div>
  );
}
