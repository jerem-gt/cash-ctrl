import { useState } from 'react';

interface CategoryEditorProps {
  name: string;
  onSave: (values: string) => void;
  onCancel?: () => void;
  isPending: boolean;
  submitLabel?: string;
  placeholder?: string;
}

export function SubcategoryEditor({
  name,
  onSave,
  onCancel,
  isPending,
  submitLabel = 'OK',
  placeholder = 'Nom de la sous-catégorie',
}: Readonly<CategoryEditorProps>) {
  const [nameValue, setNameValue] = useState(name);

  return (
    <div className="flex items-center gap-2 w-full">
      {/* NOM */}
      <input
        type="text"
        value={nameValue}
        onChange={(e) => setNameValue(e.target.value)}
        className="flex-1 bg-transparent text-sm border-b border-black/10 focus:border-black outline-none py-1"
        placeholder={placeholder}
        autoFocus
        onKeyDown={(e) => e.key === 'Enter' && onSave(nameValue)}
      />

      {/* ACTIONS */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(nameValue)}
          disabled={isPending || !nameValue.trim()}
          className="text-xs font-bold text-green-600 hover:bg-green-50 px-2 py-1 rounded"
        >
          {isPending ? '...' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-stone-400 hover:bg-stone-50 px-2 py-1 rounded"
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
