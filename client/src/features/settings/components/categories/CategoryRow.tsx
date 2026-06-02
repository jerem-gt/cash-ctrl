import { Category } from '@/types.ts';

export function CategoryRow({
  cat,
  selectedId,
  handleSelectCat,
}: Readonly<{
  cat: Category;
  selectedId: number | null;
  handleSelectCat: (id: number) => void;
}>) {
  return (
    <button
      key={cat.id}
      onClick={() => handleSelectCat(cat.id)}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
        selectedId === cat.id
          ? 'bg-surface shadow-sm ring-1 ring-line text-content'
          : 'text-content-muted hover:bg-surface-emphasis'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{cat.icon}</span>
        <span className="text-sm font-semibold tracking-tight">{cat.name}</span>
      </div>
      {(cat.tx_count ?? 0) > 0 && (
        <span className="text-[10px] font-bold opacity-30 tabular-nums">{cat.tx_count}</span>
      )}
    </button>
  );
}
