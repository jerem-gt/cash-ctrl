import { useTranslation } from 'react-i18next';

import { Button, Card, Select } from '@/components/ui';
import type { CategoryChoice } from '@/pages/import.helpers.ts';
import type { Category } from '@/types.ts';

// ─── Category mapping row ─────────────────────────────────────────────────────

interface RowProps {
  qifCategory: string;
  choice: CategoryChoice | undefined;
  categories: Category[];
  onChange: (c: CategoryChoice) => void;
}

function CategoryMappingRow({ qifCategory, choice, categories, onChange }: Readonly<RowProps>) {
  const { t } = useTranslation('settings');
  const parts = qifCategory.split(':');
  const defaultSubcatName = parts.at(-1)!;
  const action = choice?.action ?? 'skip';

  const handleActionChange = (newAction: string) => {
    if (newAction === 'skip') onChange({ action: 'skip' });
    else if (newAction === 'map') {
      const firstSubcat = categories[0]?.subcategories[0];
      onChange({ action: 'map', subcategory_id: firstSubcat?.id ?? 0 });
    } else {
      onChange({
        action: 'create',
        existing_category_id: categories[0]?.id ?? null,
        new_category_name: parts[0] ?? qifCategory,
        new_category_icon: '📁',
        subcategory_name: defaultSubcatName,
      });
    }
  };

  return (
    <div className="py-3 border-b border-stone-100 last:border-0">
      <div className="flex items-start gap-4">
        <span
          className="flex-1 text-sm font-mono text-stone-700 pt-1.5 truncate"
          title={qifCategory}
        >
          {qifCategory}
        </span>
        <div className="flex flex-col gap-2 shrink-0 items-end">
          <Select
            aria-label={t('import.aria_action_for', { name: qifCategory })}
            className="w-32"
            value={action}
            onChange={(e) => handleActionChange(e.target.value)}
          >
            <option value="skip">{t('import.action_skip')}</option>
            <option value="map">{t('import.action_map')}</option>
            <option value="create">{t('import.action_create')}</option>
          </Select>

          {action === 'map' && (
            <Select
              aria-label={t('import.aria_target_category', { name: qifCategory })}
              className="w-64"
              value={choice?.action === 'map' ? choice.subcategory_id : ''}
              onChange={(e) => onChange({ action: 'map', subcategory_id: Number(e.target.value) })}
            >
              {categories.map((cat) =>
                cat.subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {cat.name} / {sub.name}
                  </option>
                )),
              )}
            </Select>
          )}

          {action === 'create' && choice?.action === 'create' && (
            <div className="flex flex-col gap-1.5 items-end">
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400">{t('import.subcategory_label')}</span>
                <input
                  className="w-40 px-2 py-1 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500"
                  value={choice.subcategory_name}
                  onChange={(e) => onChange({ ...choice, subcategory_name: e.target.value })}
                  placeholder={t('import.subcategory_placeholder')}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400">{t('import.parent_category_label')}</span>
                <Select
                  className="w-48"
                  value={choice.existing_category_id ?? '__new__'}
                  onChange={(e) =>
                    onChange({
                      ...choice,
                      existing_category_id:
                        e.target.value === '__new__' ? null : Number(e.target.value),
                    })
                  }
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                  <option value="__new__">{t('import.new_category_option')}</option>
                </Select>
              </div>
              {choice.existing_category_id === null && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400">
                    {t('import.new_category_name_label')}
                  </span>
                  <input
                    className="w-40 px-2 py-1 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500"
                    value={choice.new_category_name}
                    onChange={(e) => onChange({ ...choice, new_category_name: e.target.value })}
                    placeholder={t('import.new_category_placeholder')}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CategoriesStep ───────────────────────────────────────────────────────────

interface CategoriesStepProps {
  uniqueCategories: string[];
  categoryChoices: Map<string, CategoryChoice>;
  setCategoryChoice: (key: string, c: CategoryChoice) => void;
  categories: Category[];
  isXhb: boolean;
  onBack: () => void;
  onNext: () => void;
}

export function CategoriesStep({
  uniqueCategories,
  categoryChoices,
  setCategoryChoice,
  categories,
  isXhb,
  onBack,
  onNext,
}: Readonly<CategoriesStepProps>) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1">
          {t('import.category_mapping_title')}
        </p>
        <p className="text-xs text-stone-400 mb-4">{t('import.category_mapping_desc')}</p>
        {uniqueCategories.length === 0 ? (
          <p className="text-sm text-stone-400 py-4 text-center">{t('import.no_categories')}</p>
        ) : (
          uniqueCategories.map((cat) => (
            <CategoryMappingRow
              key={cat}
              qifCategory={cat}
              choice={categoryChoices.get(cat)}
              categories={categories}
              onChange={(c) => setCategoryChoice(cat, c)}
            />
          ))
        )}
      </Card>

      <div className="flex justify-between">
        <Button onClick={onBack}>{tc('back')}</Button>
        <Button variant="primary" onClick={onNext}>
          {isXhb ? t('import.next_paymethods') : t('import.next_preview')}
        </Button>
      </div>
    </div>
  );
}
