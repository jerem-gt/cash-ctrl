interface Props {
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export function ItemActions({ onEdit, onDuplicate, onDelete }: Readonly<Props>) {
  return (
    <div className="flex items-center gap-0 shrink-0">
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label="Modifier"
          className="p-1.5 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-md transition-colors"
        >
          <span aria-hidden="true" className="text-[12px]">
            ✎
          </span>
        </button>
      )}
      {onDuplicate && (
        <button
          type="button"
          onClick={onDuplicate}
          aria-label="Dupliquer"
          className="p-1.5 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded-md transition-colors"
        >
          <span aria-hidden="true" className="text-[14px]">
            ⧉
          </span>
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Supprimer"
          className="p-1.5 text-stone-300 hover:text-red-400 hover:bg-red-50 rounded-md transition-colors"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ×
          </span>
        </button>
      )}
    </div>
  );
}
