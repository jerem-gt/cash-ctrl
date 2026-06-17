import { lazy, Suspense } from 'react';

import { Card, CardTitle, Empty, Skeleton } from '@/components/ui';
import { fmt } from '@/lib/format';

import { CategoryList } from './CategoryList';
import { SectionLabel } from './SectionLabel';

const ExpensesPieChart = lazy(() => import('@/components/charts/ExpensesPieChart'));

interface CategoryPieCardProps {
  sectionLabel: string;
  data: Array<{ name: string; value: number; fill: string | undefined }>;
  total: number;
  emptyMessage: string;
}

export function CategoryPieCard({
  sectionLabel,
  data,
  total,
  emptyMessage,
}: Readonly<CategoryPieCardProps>) {
  return (
    <div>
      <SectionLabel label={sectionLabel} />
      <Card className="mt-3">
        <CardTitle>{fmt(total)}</CardTitle>
        {data.length === 0 ? (
          <Empty>{emptyMessage}</Empty>
        ) : (
          <>
            <Suspense fallback={<Skeleton className="h-44" />}>
              <ExpensesPieChart data={data} />
            </Suspense>
            <CategoryList data={data} total={total} />
          </>
        )}
      </Card>
    </div>
  );
}
