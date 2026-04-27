import React, { useId } from 'react';

import { Skeleton } from '@/components/ui.tsx';

type Props<T> = {
  isLoading: boolean;
  items: T[];
  empty: string;
  render: (item: T) => React.ReactNode;
  skeletonCount?: number;
};

function SkeletonRows({ count = 3 }: Readonly<{ count?: number }>) {
  const id = useId();
  return (
    <div className="mb-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`skeleton-item-${id}-${i}`}
          className="flex items-center gap-2.5 py-2 border-b border-black/[0.06] last:border-0"
        >
          <Skeleton className="w-5 h-5 shrink-0" />
          <Skeleton className="h-3.5 flex-1" />
        </div>
      ))}
    </div>
  );
}

export function ListContent<T>({
  isLoading,
  items,
  empty,
  render,
  skeletonCount = 3,
}: Readonly<Props<T>>) {
  if (isLoading) return <SkeletonRows count={skeletonCount} />;
  if (items.length === 0) return <p className="text-sm text-stone-400 py-2">{empty}</p>;

  return <>{items.map(render)}</>;
}
