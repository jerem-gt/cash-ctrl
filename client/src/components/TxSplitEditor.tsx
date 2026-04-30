import { Select } from '@/components/ui';
import type { Category, Subcategory } from '@/types';

export interface SplitInput {
  _key: string;
  category_id: string;
  subcategory_id: string;
  amount: string;
}

interface Props {
  splits: SplitInput[];
  onChange: (splits: SplitInput[]) => void;
  categories: Pick<Category, 'id' | 'name' | 'subcategories'>[];
  totalAmount: number;
}

export function TxSplitEditor({ splits, onChange, categories, totalAmount }: Readonly<Props>) {
  const sum = splits.reduce((acc, s) => acc + (Number.parseFloat(s.amount) || 0), 0);
  const remaining = Math.round((totalAmount - sum) * 100) / 100;

  const update = (key: string, patch: Partial<Omit<SplitInput, '_key'>>) =>
    onChange(splits.map((s) => (s._key === key ? { ...s, ...patch } : s)));

  const remove = (key: string) => onChange(splits.filter((s) => s._key !== key));

  const add = () =>
    onChange([
      ...splits,
      { _key: String(Date.now() + Math.random()), category_id: '', subcategory_id: '', amount: '' },
    ]);

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Ventilation</p>
      {splits.map((s) => {
        const subcats: Subcategory[] =
          categories.find((c) => String(c.id) === s.category_id)?.subcategories ?? [];
        return (
          <div key={s._key} className="flex gap-2 items-center">
            <Select
              value={s.category_id}
              onChange={(e) => update(s._key, { category_id: e.target.value, subcategory_id: '' })}
              className="flex-1"
            >
              <option value="">Catégorie</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              value={s.subcategory_id}
              onChange={(e) => update(s._key, { subcategory_id: e.target.value })}
              disabled={!s.category_id}
              className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Sous-cat.</option>
              {subcats.map((sub) => (
                <option key={sub.id} value={String(sub.id)}>
                  {sub.name}
                </option>
              ))}
            </Select>
            <input
              type="number"
              value={s.amount}
              onChange={(e) => update(s._key, { amount: e.target.value })}
              placeholder="0,00"
              min="0.01"
              step="0.01"
              className="w-20 px-2 py-2 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500 transition-all"
            />
            <button
              type="button"
              onClick={() => remove(s._key)}
              className="text-stone-300 hover:text-red-400 transition-colors text-lg leading-none px-1"
            >
              ×
            </button>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-0.5">
        <button
          type="button"
          onClick={add}
          className="text-[11px] font-bold text-stone-400 hover:text-stone-700 uppercase tracking-wider"
        >
          + Ajouter
        </button>
        <span
          className={`text-[11px] font-mono tabular-nums ${Math.abs(remaining) < 0.005 ? 'text-green-600' : 'text-red-500'}`}
        >
          Reste : {remaining.toFixed(2)} €
        </span>
      </div>
    </div>
  );
}
