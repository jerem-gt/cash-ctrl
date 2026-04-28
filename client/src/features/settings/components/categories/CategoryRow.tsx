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
          ? 'bg-white shadow-sm ring-1 ring-black/5 text-black'
          : 'text-stone-500 hover:bg-black/5'
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
