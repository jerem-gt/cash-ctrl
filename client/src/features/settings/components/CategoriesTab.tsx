import { useState } from 'react';

import { ListContent } from '@/components/ListContent.tsx';
import { Card, CardTitle, showToast } from '@/components/ui.tsx';
import { useDeleteConfirmation } from '@/features/settings/hooks/useDeleteConfirmation.tsx';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '@/hooks/useCategories.ts';
import { Category } from '@/types.ts';

import { CategoryEditor } from './CategoryEditor';

function CategoryRow({
  cat,
  onSaved,
  onDelete,
}: Readonly<{
  cat: Category;
  onSaved: () => void;
  onDelete: (id: number) => void;
}>) {
  const [editing, setEditing] = useState(false);
  const updateCategory = useUpdateCategory();

  if (editing) {
    return (
      <CategoryEditor
        initialValues={{ name: cat.name, color: cat.color, icon: cat.icon }}
        isPending={updateCategory.isPending}
        onCancel={() => setEditing(false)}
        onSave={(values) => {
          updateCategory.mutate(
            { id: cat.id, ...values },
            {
              onSuccess: () => {
                setEditing(false);
                onSaved();
              },
              onError: (err) => showToast(err.message),
            },
          );
        }}
      />
    );
  }

  // Mode lecture
  const txCount = cat.tx_count ?? 0;
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-black/[0.06] last:border-0 group">
      <div
        className="w-3.5 h-3.5 rounded-sm shrink-0 shadow-sm ring-1 ring-inset ring-black/5"
        style={{ background: cat.color }}
      />
      <div className="text-base">{cat.icon}</div>
      <span className="flex-1 text-sm">{cat.name}</span>
      {txCount > 0 && (
        <span className="text-[10px] text-stone-400 tabular-nums shrink-0">{txCount} tx</span>
      )}
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-stone-400 opacity-0 group-hover:opacity-100 transition-colors"
      >
        Modifier
      </button>
      {txCount === 0 && (
        <button
          onClick={() => onDelete(cat.id)}
          className="text-xs text-stone-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function CategoriesTab() {
  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const { requestDelete, DeleteConfirmModal } = useDeleteConfirmation(showToast);

  if (catsLoading) return <div>Loading...</div>;

  return (
    <Card>
      <CardTitle>Catégories</CardTitle>
      <div className="mb-4">
        <ListContent
          isLoading={catsLoading}
          items={categories}
          empty="Aucune catégorie"
          skeletonCount={4}
          render={(cat) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              onSaved={() => showToast('Catégorie mise à jour ✓')}
              onDelete={(id) =>
                requestDelete(
                  'Supprimer la catégorie',
                  'Confirmer la suppression ?',
                  id,
                  deleteCategory.mutate,
                  'Catégorie supprimée',
                )
              }
            />
          )}
        />
      </div>
      <div className="mt-6 pt-4 border-t border-black/[0.06]">
        <p className="text-[10px] font-bold text-stone-400 uppercase mb-2 ml-1">
          Nouvelle catégorie
        </p>
        <CategoryEditor
          initialValues={{ name: '', color: '#9E9A92', icon: '❓' }}
          isPending={createCategory.isPending}
          submitLabel="Ajouter"
          onSave={(values) => {
            if (!values.name.trim()) return showToast('Donnez un nom à la catégorie.');
            createCategory.mutate(values, {
              onSuccess: () => {
                showToast('Catégorie ajoutée ✓');
              },
              onError: (err) => showToast(err.message),
            });
          }}
        />
      </div>

      <DeleteConfirmModal />
    </Card>
  );
}
