import { Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { IconButton, showToast } from '@/components/ui';
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
  const { t } = useTranslation('settings');
  const [editing, setEditing] = useState(false);
  const updateSubcategory = useUpdateSubcategory();

  if (editing) {
    return (
      <SubcategoryEditor
        name={sub.name}
        isPending={updateSubcategory.isPending}
        autoFocus
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
  const deleteTitle =
    txCount > 0
      ? t('categories.subcategory_delete_disabled', { count: txCount })
      : t('card.delete_label');
  return (
    <div className="flex items-center gap-4 py-2 px-3 border-b border-line-subtle group hover:bg-surface-muted/80 transition-colors">
      {/* 1. Zone Nom : prend tout l'espace et gère le débordement */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-content-secondary truncate block tracking-tight">
          {sub.name}
        </span>
      </div>

      {/* 2. Zone Info & Actions : regroupées à droite pour l'alignement vertical */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Compteur compact : "tx" au lieu de "transactions" pour gagner de la place */}
        {txCount > 0 && (
          <span className="text-[10px] font-bold text-content-subtle bg-surface-emphasis/80 px-2 py-0.5 rounded-full tabular-nums">
            {txCount} tx
          </span>
        )}

        {/* 3. Groupe d'actions */}
        <div className="flex items-center gap-0.5">
          <IconButton label={t('card.edit_label')} size="sm" onClick={() => setEditing(true)}>
            <Pencil size={14} strokeWidth={1.5} />
          </IconButton>
          <IconButton
            label={t('card.delete_label')}
            size="sm"
            variant="danger"
            onClick={() => onDelete(sub.id)}
            disabled={txCount > 0}
            title={deleteTitle}
          >
            <X size={16} strokeWidth={2} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
