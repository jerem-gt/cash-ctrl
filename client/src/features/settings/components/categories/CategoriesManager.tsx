import { useState } from 'react';

import { ListContent } from '@/components/ListContent.tsx';
import { showToast } from '@/components/ui.tsx';
import { CategoryDetails } from '@/features/settings/components/categories/CategoryDetails.tsx';
import {
  CategoryEditor,
  CategoryForm,
} from '@/features/settings/components/categories/CategoryEditor.tsx';
import { CategoryRow } from '@/features/settings/components/categories/CategoryRow.tsx';
import { useCategories, useCreateCategory } from '@/hooks/useCategories.ts';

export function CategoriesManager() {
  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const [resetCreationFormKey, setResetCreationFormKey] = useState(0);
  const createCategory = useCreateCategory();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedCategory = categories.find((c) => c.id === selectedId);

  if (catsLoading) return <div>Chargement...</div>;

  function handleSaveCategory(values: CategoryForm) {
    if (!values.name.trim()) return showToast('Donnez un nom à la catégorie.');
    createCategory.mutate(values, {
      onSuccess: () => {
        showToast('Catégorie ajoutée ✓');
        setResetCreationFormKey((prev) => prev + 1);
      },
      onError: (err) => showToast(err.message),
    });
  }

  return (
    <div className="flex items-start gap-8 mx-auto px-4">
      {/* COLONNE GAUCHE */}
      <div className="w-[320px] shrink-0">
        <div>
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4 ml-1">
            Catégories
          </p>

          <div className="p-3 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
            <p className="text-[10px] font-bold text-stone-400 uppercase mb-3 ml-1">
              Nouvelle catégorie
            </p>
            <CategoryEditor
              key={resetCreationFormKey}
              initialValues={{ name: '', color: '#9E9A92', icon: '❓' }}
              isPending={createCategory.isPending}
              onSave={(values) => handleSaveCategory(values)}
            />
          </div>
          <ListContent
            isLoading={catsLoading}
            items={categories}
            empty={''}
            render={(cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                selectedId={selectedId}
                handleSelectCat={setSelectedId}
              />
            )}
          />
        </div>
      </div>

      {/* COLONNE DROITE */}
      <CategoryDetails key={selectedCategory?.id} selectedCategory={selectedCategory} />
    </div>
  );
}
