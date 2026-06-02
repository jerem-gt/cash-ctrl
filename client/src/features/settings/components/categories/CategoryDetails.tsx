import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { showToast } from '@/components/ui';
import {
  CategoryEditor,
  CategoryForm,
} from '@/features/settings/components/categories/CategoryEditor.tsx';
import { SubCategoriesManager } from '@/features/settings/components/categories/SubcategoriesManager.tsx';
import { useDeleteConfirmation } from '@/features/settings/hooks/useDeleteConfirmation.tsx';
import { useDeleteCategory, useUpdateCategory } from '@/hooks/useCategories.ts';
import { Category } from '@/types.ts';

export function CategoryDetails({
  selectedCategory,
}: Readonly<{
  selectedCategory?: Category;
}>) {
  const { t } = useTranslation('settings');
  const [isEditingCat, setIsEditingCat] = useState(false);
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();
  const { requestDelete, deleteConfirmModal } = useDeleteConfirmation(showToast);

  function handleUpdateCategory(catId: number, values: CategoryForm) {
    updateCat.mutate(
      { id: catId, ...values },
      {
        onSuccess: () => {
          setIsEditingCat(false);
          showToast(t('categories.update_success'));
        },
        onError: (err) => showToast(err.message),
      },
    );
  }

  if (selectedCategory) {
    return (
      <div className="flex-1 min-w-0 bg-surface rounded-4xl p-8 shadow-sm border border-line-subtle">
        <div className="max-w-2xl mx-auto">
          {isEditingCat ? (
            <div className="mb-8 bg-surface-muted p-6 rounded-2xl border border-line-subtle animate-in fade-in zoom-in-95">
              <CategoryEditor
                initialValues={{
                  name: selectedCategory.name,
                  icon: selectedCategory.icon,
                }}
                isPending={updateCat.isPending}
                submitLabel={t('categories.editor_edit_label')}
                onCancel={() => setIsEditingCat(false)}
                onSave={(values) => handleUpdateCategory(selectedCategory.id, values)}
              />
            </div>
          ) : (
            <header className="flex justify-between items-center mb-10 pb-8 border-b border-line-subtle">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-surface-muted flex items-center justify-center text-3xl shadow-inner ring-1 ring-line">
                  {selectedCategory.icon}
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-content leading-none">
                    {selectedCategory.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-bold text-content-subtle uppercase tracking-widest">
                      {t('categories.main_label')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditingCat(true)}
                  className="px-4 py-2 text-[11px] font-bold text-content-muted hover:text-content bg-surface-muted hover:bg-surface-emphasis rounded-xl transition-all"
                >
                  {t('categories.editor_edit_label')}
                </button>
                <button
                  onClick={() => {
                    requestDelete(
                      t('categories.delete_title'),
                      t('categories.delete_body'),
                      selectedCategory.id,
                      deleteCat.mutate,
                      t('categories.delete_success'),
                    );
                  }}
                  className="px-4 py-2 text-[11px] font-bold text-danger hover:bg-danger-surface rounded-xl transition-all"
                >
                  {t('card.delete_label')}
                </button>
              </div>
            </header>
          )}

          {/* LISTE DES SOUS-CATÉGORIES */}
          <SubCategoriesManager key={selectedCategory?.id} parentCategory={selectedCategory} />
        </div>
        {deleteConfirmModal}
      </div>
    );
  }
  return (
    <div className="flex-1 h-64 flex flex-col items-center justify-center border-2 border-dashed border-line-subtle rounded-4xl text-content-faint italic animate-in fade-in duration-500">
      {t('categories.select_prompt')}
    </div>
  );
}
