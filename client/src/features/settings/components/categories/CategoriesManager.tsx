import { Search } from 'lucide-react';
import { useState } from 'react';

import { showToast } from '@/components/ui';
import {
  CategoryEditor,
  CategoryForm,
} from '@/features/settings/components/categories/CategoryEditor.tsx';
import { SubCategoriesManager } from '@/features/settings/components/categories/SubcategoriesManager.tsx';
import { SettingsCard } from '@/features/settings/components/SettingsCard.tsx';
import { SettingsManagerSkeleton } from '@/features/settings/components/SettingsManager.tsx';
import { useDeleteConfirmation } from '@/features/settings/hooks/useDeleteConfirmation.tsx';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '@/hooks/useCategories.ts';
import { Category } from '@/types.ts';

function CategoryEditForm({ cat, onClose }: Readonly<{ cat: Category; onClose: () => void }>) {
  const updateCat = useUpdateCategory();

  return (
    <CategoryEditor
      initialValues={{ name: cat.name, icon: cat.icon }}
      isPending={updateCat.isPending}
      submitLabel="Modifier"
      autoFocus
      onCancel={onClose}
      onSave={(values) => {
        updateCat.mutate(
          { id: cat.id, ...values },
          {
            onSuccess: () => {
              onClose();
              showToast('Catégorie mise à jour ✓');
            },
            onError: (err) => showToast(err.message),
          },
        );
      }}
    />
  );
}

export function CategoryCard({ cat }: Readonly<{ cat: Category }>) {
  const [editing, setEditing] = useState(false);
  const deleteCat = useDeleteCategory();
  const { requestDelete, DeleteConfirmModal } = useDeleteConfirmation(showToast);

  return (
    <>
      <SettingsCard
        title={cat.name}
        icon={cat.icon}
        subtitle={
          <p className="text-[10px] text-stone-400">
            {cat.subcategories.length} sous-catégorie
            {cat.subcategories.length === 1 ? '' : 's'}
          </p>
        }
        canDelete={cat.subcategories.length === 0}
        onDelete={() =>
          requestDelete(
            'Supprimer la catégorie',
            'Confirmer la suppression ?',
            cat.id,
            deleteCat.mutate,
            'Catégorie supprimée',
          )
        }
        isEditing={editing}
        onEditStart={() => setEditing(true)}
        editContent={<CategoryEditForm cat={cat} onClose={() => setEditing(false)} />}
        collapsibleContent={<SubCategoriesManager parentCategory={cat} />}
      />
      <DeleteConfirmModal />
    </>
  );
}

export function CategoriesManager() {
  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const [resetCreationFormKey, setResetCreationFormKey] = useState(0);
  const [search, setSearch] = useState('');
  const createCategory = useCreateCategory();

  if (catsLoading) return <SettingsManagerSkeleton />;

  const filtered = search.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

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
    <div className="flex flex-col gap-6">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Catégories</p>
      <div
        data-testid="new-category-form"
        className="p-3 bg-stone-50 rounded-2xl border border-dashed border-stone-200"
      >
        <p className="text-[10px] font-bold text-stone-400 uppercase mb-3 ml-1">
          Nouvelle catégorie
        </p>
        <CategoryEditor
          key={resetCreationFormKey}
          initialValues={{ name: '', icon: '❓' }}
          isPending={createCategory.isPending}
          onSave={(values) => handleSaveCategory(values)}
        />
      </div>
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300 pointer-events-none"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une catégorie…"
          className="w-full text-sm bg-white border border-black/10 rounded-xl pl-8 pr-3 py-2 outline-none focus:border-black/30 transition-colors placeholder:text-stone-300"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-stone-300 italic text-center py-6">
          Aucune catégorie ne correspond à &laquo;&nbsp;{search}&nbsp;&raquo;
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {filtered.map((cat) => (
            <CategoryCard key={cat.id} cat={cat} />
          ))}
        </div>
      )}
    </div>
  );
}
