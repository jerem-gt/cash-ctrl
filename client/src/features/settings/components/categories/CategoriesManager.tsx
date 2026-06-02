import { Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { showToast } from '@/components/ui';
import { AddCard } from '@/features/settings/components/AddCard.tsx';
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
  const { t } = useTranslation('settings');
  const updateCat = useUpdateCategory();

  return (
    <CategoryEditor
      initialValues={{ name: cat.name, icon: cat.icon }}
      isPending={updateCat.isPending}
      submitLabel={t('categories.editor_edit_label')}
      autoFocus
      onCancel={onClose}
      onSave={(values) => {
        updateCat.mutate(
          { id: cat.id, ...values },
          {
            onSuccess: () => {
              onClose();
              showToast(t('categories.update_success'));
            },
            onError: (err) => showToast(err.message),
          },
        );
      }}
    />
  );
}

export function CategoryCard({ cat }: Readonly<{ cat: Category }>) {
  const { t } = useTranslation('settings');
  const [editing, setEditing] = useState(false);
  const deleteCat = useDeleteCategory();
  const { requestDelete, deleteConfirmModal } = useDeleteConfirmation(showToast);

  return (
    <>
      <SettingsCard
        title={cat.name}
        icon={cat.icon}
        subtitle={
          <p className="text-[10px] text-stone-400">
            {t('categories.count_sub', { count: cat.subcategories.length })}
          </p>
        }
        canDelete={cat.subcategories.length === 0}
        onDelete={() =>
          requestDelete(
            t('categories.delete_title'),
            t('categories.delete_body'),
            cat.id,
            deleteCat.mutate,
            t('categories.delete_success'),
          )
        }
        isEditing={editing}
        onEditStart={() => setEditing(true)}
        editContent={<CategoryEditForm cat={cat} onClose={() => setEditing(false)} />}
        collapsibleContent={<SubCategoriesManager parentCategory={cat} />}
      />
      {deleteConfirmModal}
    </>
  );
}

export function CategoriesManager() {
  const { t } = useTranslation('settings');
  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const [resetCreationFormKey, setResetCreationFormKey] = useState(0);
  const [search, setSearch] = useState('');
  const createCategory = useCreateCategory();

  if (catsLoading) return <SettingsManagerSkeleton />;

  const filtered = search.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  function handleSaveCategory(values: CategoryForm) {
    if (!values.name.trim()) return showToast(t('categories.err_no_name'));
    createCategory.mutate(values, {
      onSuccess: () => {
        showToast(t('categories.create_success'));
        setResetCreationFormKey((prev) => prev + 1);
      },
      onError: (err) => showToast(err.message),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
        {t('categories.title')}
      </p>
      <div data-testid="new-category-form">
        <AddCard title={t('categories.new_title')}>
          <CategoryEditor
            key={resetCreationFormKey}
            initialValues={{ name: '', icon: '❓' }}
            isPending={createCategory.isPending}
            onSave={(values) => handleSaveCategory(values)}
          />
        </AddCard>
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
          placeholder={t('categories.search_placeholder')}
          className="w-full text-sm bg-white border border-black/10 rounded-xl pl-8 pr-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all placeholder:text-stone-300"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-stone-300 italic text-center py-6">
          {t('categories.no_match', { search })}
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
