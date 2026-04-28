import { useState } from 'react';

import { showToast } from '@/components/ui.tsx';
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
  const [isEditingCat, setIsEditingCat] = useState(false);
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();
  const { requestDelete, DeleteConfirmModal } = useDeleteConfirmation(showToast);

  function handleUpdateCategory(catId: number, values: CategoryForm) {
    updateCat.mutate(
      { id: catId, ...values },
      {
        onSuccess: () => {
          setIsEditingCat(false);
          showToast('Catégorie mise à jour ✓');
        },
        onError: (err) => showToast(err.message),
      },
    );
  }

  if (selectedCategory) {
    return (
      <div className="flex-1 min-w-0 bg-white rounded-4xl p-8 shadow-sm border border-black/5">
        <div className="max-w-2xl mx-auto">
          {isEditingCat ? (
            <div className="mb-8 bg-stone-50 p-6 rounded-2xl border border-black/5 animate-in fade-in zoom-in-95">
              <CategoryEditor
                initialValues={{
                  name: selectedCategory.name,
                  color: selectedCategory.color,
                  icon: selectedCategory.icon,
                }}
                isPending={updateCat.isPending}
                submitLabel="Modifier"
                onCancel={() => setIsEditingCat(false)}
                onSave={(values) => handleUpdateCategory(selectedCategory.id, values)}
              />
            </div>
          ) : (
            <header className="flex justify-between items-center mb-10 pb-8 border-b border-black/3">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-stone-50 flex items-center justify-center text-3xl shadow-inner ring-1 ring-black/5">
                  {selectedCategory.icon}
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 leading-none">
                    {selectedCategory.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: selectedCategory.color }}
                    />
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                      Catégorie principale
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditingCat(true)}
                  className="px-4 py-2 text-[11px] font-bold text-stone-500 hover:text-black bg-stone-50 hover:bg-stone-100 rounded-xl transition-all"
                >
                  Modifier
                </button>
                <button
                  onClick={() => {
                    requestDelete(
                      'Supprimer la catégorie',
                      'Confirmer la suppression ?',
                      selectedCategory.id,
                      deleteCat.mutate,
                      'Catégorie supprimée',
                    );
                  }}
                  className="px-4 py-2 text-[11px] font-bold text-red-400 hover:bg-red-50 rounded-xl transition-all"
                >
                  Supprimer
                </button>
              </div>
            </header>
          )}

          {/* LISTE DES SOUS-CATÉGORIES */}
          <SubCategoriesManager key={selectedCategory?.id} parentCategory={selectedCategory} />
        </div>
        <DeleteConfirmModal />
      </div>
    );
  }
  return (
    <div className="flex-1 h-64 flex flex-col items-center justify-center border-2 border-dashed border-black/5 rounded-4xl text-stone-300 italic animate-in fade-in duration-500">
      Sélectionnez une catégorie pour gérer ses détails
    </div>
  );
}
