import { ReimbursementStatus } from '@/types.ts';

interface ReimbStatusProps {
  status: ReimbursementStatus;
  onChange: (s: ReimbursementStatus) => void;
}

export function ReimbursementStatusPicker({ status, onChange }: Readonly<ReimbStatusProps>) {
  return (
    <div className="border-t border-black/[0.07] pt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-medium uppercase tracking-widest text-stone-400">
          Suivi remboursement
        </p>
        <button
          type="button"
          onClick={() => onChange(status === null ? 'en_attente' : null)}
          className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg transition-all ${
            status === null
              ? 'text-stone-400 hover:text-stone-600 hover:bg-stone-50'
              : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
          }`}
        >
          {status === null ? 'Activer' : '⚕ Actif'}
        </button>
      </div>
      {status !== null && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange('en_attente')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              status === 'en_attente'
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-stone-50 border-black/10 text-stone-400 hover:bg-stone-100'
            }`}
          >
            En attente
          </button>
          <button
            type="button"
            onClick={() => onChange('rembourse')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              status === 'rembourse'
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'bg-stone-50 border-black/10 text-stone-400 hover:bg-stone-100'
            }`}
          >
            Remboursement terminé
          </button>
        </div>
      )}
    </div>
  );
}
