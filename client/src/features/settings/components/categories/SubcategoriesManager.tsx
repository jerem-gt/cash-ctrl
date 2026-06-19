import { Category } from '@cashctrl/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ListContent } from '@/components/ListContent.tsx';
import { showToast } from '@/components/ui';
import { SubcategoryEditor } from '@/features/settings/components/categories/SubcategoryEditor.tsx';
import { SubcategoryRow } from '@/features/settings/components/categories/SubcategoryRow.tsx';
import { useDeleteConfirmation } from '@/features/settings/hooks/useDeleteConfirmation.tsx';
import { useCreateSubcategory, useDeleteSubcategory } from '@/hooks/useSubcategories.ts';

export function SubCategoriesManager({ parentCategory }: Readonly<{ parentCategory: Category }>) {
  const { t } = useTranslation('settings');
  const [resetCreationFormKey, setResetCreationFormKey] = useState(0);
  const createSub = useCreateSubcategory();
  const deleteSub = useDeleteSubcategory();
  const { requestDelete, deleteConfirmModal } = useDeleteConfirmation(showToast);

  function handleSaveSubcategory(value: string) {
    createSub.mutate(
      { category_id: parentCategory.id, name: value },
      {
        onSuccess: () => {
          showToast(t('categories.subcategory_create_success'));
          setResetCreationFormKey((prev) => prev + 1);
        },
        onError: (err) => showToast(err.message),
      },
    );
  }

  return (
    <>
      <div className="mb-8 p-1 border-b border-line-subtle focus-within:border-line-strong transition-colors">
        <SubcategoryEditor
          key={resetCreationFormKey}
          name=""
          isPending={createSub.isPending}
          submitLabel={t('categories.subcategory_add_label')}
          onSave={(value) => handleSaveSubcategory(value)}
        />
      </div>
      <div>
        <ListContent
          items={parentCategory.subcategories}
          isLoading={false}
          empty={t('categories.subcategory_no_items')}
          render={(sub) => (
            <SubcategoryRow
              key={sub.id}
              sub={sub}
              onEdit={() => showToast(t('categories.subcategory_update_success'))}
              onDelete={(id) =>
                requestDelete(
                  t('categories.subcategory_delete_title'),
                  t('categories.delete_body'),
                  id,
                  deleteSub.mutate,
                  t('categories.subcategory_delete_success'),
                )
              }
            />
          )}
        />
      </div>
      {deleteConfirmModal}
    </>
  );
}
