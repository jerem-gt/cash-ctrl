import { useState } from 'react';

import { ListContent } from '@/components/ListContent.tsx';
import { showToast } from '@/components/ui.tsx';
import { SubcategoryEditor } from '@/features/settings/components/categories/SubcategoryEditor.tsx';
import { SubcategoryRow } from '@/features/settings/components/categories/SubcategoryRow.tsx';
import { useDeleteConfirmation } from '@/features/settings/hooks/useDeleteConfirmation.tsx';
import { useCreateSubcategory, useDeleteSubcategory } from '@/hooks/useSubcategories.ts';
import { Category } from '@/types.ts';

export function SubCategoriesManager({ parentCategory }: Readonly<{ parentCategory: Category }>) {
  const [resetCreationFormKey, setResetCreationFormKey] = useState(0);
  const createSub = useCreateSubcategory();
  const deleteSub = useDeleteSubcategory();
  const { requestDelete, DeleteConfirmModal } = useDeleteConfirmation(showToast);

  function handleSaveSubcategory(value: string) {
    createSub.mutate(
      { category_id: parentCategory.id, name: value },
      {
        onSuccess: () => {
          showToast('Sous-catégorie ajoutée ✓');
          setResetCreationFormKey((prev) => prev + 1);
        },
        onError: (err) => showToast(err.message),
      },
    );
  }

  return (
    <>
      <div className="mb-8 p-1 border-b border-black/5 focus-within:border-black/20 transition-colors">
        <SubcategoryEditor
          key={resetCreationFormKey}
          name=""
          isPending={createSub.isPending}
          submitLabel="Ajouter"
          onSave={(value) => handleSaveSubcategory(value)}
        />
      </div>
      <div>
        <ListContent
          items={parentCategory.subcategories}
          isLoading={false}
          empty="Aucune sous-catégorie dans cette catégorie."
          render={(sub) => (
            <SubcategoryRow
              key={sub.id}
              sub={sub}
              onEdit={() => showToast('Sous-catégorie mise à jour ✓')}
              onDelete={(id) =>
                requestDelete(
                  'Supprimer la sous-catégorie',
                  'Confirmer la suppression ?',
                  id,
                  deleteSub.mutate,
                  'Catégorie supprimée',
                )
              }
            />
          )}
        />
      </div>
      <DeleteConfirmModal />
    </>
  );
}
