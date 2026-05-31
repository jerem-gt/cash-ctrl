import { Card, Skeleton } from '@/components/ui';

export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} size="sm">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-7 w-28" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        <Card className="md:col-span-2">
          <Skeleton className="h-3 w-32 mb-4" />
          <Skeleton className="h-44" />
        </Card>
        <Card className="md:col-span-3">
          <Skeleton className="h-3 w-40 mb-4" />
          <Skeleton className="h-44" />
        </Card>
      </div>
      <Card>
        <Skeleton className="h-3 w-48 mb-4" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      </Card>
    </div>
  );
}
