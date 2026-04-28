import { useState } from 'react';

import { showToast } from '@/components/ui.tsx';
import { SubcategoryEditor } from '@/features/settings/components/categories/SubcategoryEditor.tsx';
import { useUpdateSubcategory } from '@/hooks/useSubcategories.ts';
import { Subcategory } from '@/types.ts';

export function SubcategoryRow({
  sub,
  onEdit,
  onDelete,
}: Readonly<{
  sub: Subcategory;
  onEdit: () => void;
  onDelete: (id: number) => void;
}>) {
  const [editing, setEditing] = useState(false);
  const updateSubcategory = useUpdateSubcategory();

  if (editing) {
    return (
      <SubcategoryEditor
        name={sub.name}
        isPending={updateSubcategory.isPending}
        onCancel={() => setEditing(false)}
        onSave={(value) => {
          updateSubcategory.mutate(
            { id: sub.id, name: value },
            {
              onSuccess: () => {
                setEditing(false);
                onEdit();
              },
              onError: (err) => showToast(err.message),
            },
          );
        }}
      />
    );
  }

  // Mode lecture
  const txCount = sub.tx_count ?? 0;
  return (
    <div className="flex items-center gap-4 py-2 px-3 border-b border-black/3 group hover:bg-stone-50/80 transition-colors">
      {/* 1. Zone Nom : prend tout l'espace et gère le débordement */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-stone-600 truncate block tracking-tight">
          {sub.name}
        </span>
      </div>

      {/* 2. Zone Info & Actions : regroupées à droite pour l'alignement vertical */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Compteur compact : "tx" au lieu de "transactions" pour gagner de la place */}
        {txCount > 0 && (
          <span className="text-[10px] font-bold text-stone-400 bg-stone-100/80 px-2 py-0.5 rounded-full tabular-nums">
            {txCount} tx
          </span>
        )}

        {/* 3. Groupe d'actions : boutons plus grands mais icônes fines */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setEditing(true)}
            className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-200/50 rounded-lg transition-all"
            title="Modifier"
          >
            <span className="text-xs block leading-none">✎</span>
          </button>

          {/* On utilise opacity-0 pour garder l'alignement même si le bouton est masqué */}
          <button
            onClick={() => onDelete(sub.id)}
            disabled={txCount > 0}
            className={`p-2 rounded-lg transition-all ${
              txCount > 0
                ? 'opacity-0 pointer-events-none'
                : 'text-stone-300 hover:text-red-500 hover:bg-red-50'
            }`}
            title="Supprimer"
          >
            <span className="text-base block leading-none">×</span>
          </button>
        </div>
      </div>
    </div>
  );
}
