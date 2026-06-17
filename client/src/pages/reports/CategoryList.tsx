import { fmt } from '@/lib/format';

interface CategoryListProps {
  data: Array<{ name: string; value: number; fill: string | undefined }>;
  total: number;
}

export function CategoryList({ data, total }: Readonly<CategoryListProps>) {
  return (
    <div className="flex flex-col gap-1.5 mt-3">
      {data.map((d) => {
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
        return (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: d.fill }} />
            <span className="text-xs text-content-muted flex-1 truncate">{d.name || '—'}</span>
            <span className="text-xs text-content-subtle tabular-nums">{pct}%</span>
            <span className="text-xs font-medium text-content-secondary tabular-nums w-20 text-right">
              {fmt(d.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
