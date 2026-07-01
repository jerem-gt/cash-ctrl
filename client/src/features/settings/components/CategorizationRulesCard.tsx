import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CategorizationRule } from '@/api/client';
import {
  Button,
  Card,
  CardTitle,
  ConfirmModal,
  FormGroup,
  Input,
  Select,
  showToast,
} from '@/components/ui';
import { useCategories } from '@/hooks/useCategories';
import {
  useCategorizationRules,
  useCreateCategorizationRule,
  useDeleteAllCategorizationRules,
  useDeleteCategorizationRule,
  useInitCategorizationRulesFromHistory,
  useUpdateCategorizationRule,
} from '@/hooks/useCategorizationRules';

interface RuleRowProps {
  rule: CategorizationRule;
  subcategoryLabel: string;
}

function RuleRow({ rule, subcategoryLabel }: Readonly<RuleRowProps>) {
  const { t } = useTranslation('settings');
  const [editing, setEditing] = useState(false);
  const [pattern, setPattern] = useState(rule.pattern);
  const [subcategoryId, setSubcategoryId] = useState(String(rule.subcategory_id));
  const { data: categories = [] } = useCategories();
  const update = useUpdateCategorizationRule();
  const remove = useDeleteCategorizationRule();
  const [errors, setErrors] = useState<Set<string>>(() => new Set());

  const handleSave = () => {
    const errs = new Set<string>();
    if (!pattern.trim()) errs.add('pattern');
    if (!subcategoryId) errs.add('subcategoryId');
    if (errs.size > 0) {
      setErrors(errs);
      if (errs.has('pattern')) showToast(t('categorization_rules.err_pattern'));
      else showToast(t('categorization_rules.err_subcategory'));
      return;
    }
    setErrors(new Set());
    update.mutate(
      { id: rule.id, pattern: pattern.trim(), subcategoryId: Number(subcategoryId) },
      {
        onSuccess: () => {
          showToast(t('categorization_rules.success_update'));
          setEditing(false);
        },
      },
    );
  };

  const handleDelete = () => {
    remove.mutate(rule.id, {
      onSuccess: () => showToast(t('categorization_rules.success_delete')),
    });
  };

  if (editing) {
    return (
      <div className="flex flex-wrap gap-2 items-end p-3 rounded-xl bg-surface-muted border border-line">
        <FormGroup label={t('categorization_rules.pattern_label')} className="min-w-40 flex-1">
          <Input
            type="text"
            value={pattern}
            onChange={(e) => {
              setErrors((p) => {
                const s = new Set(p);
                s.delete('pattern');
                return s;
              });
              setPattern(e.target.value);
            }}
            autoFocus
            error={errors.has('pattern')}
          />
        </FormGroup>
        <FormGroup label={t('categorization_rules.subcategory_label')} className="min-w-40 flex-1">
          <Select
            value={subcategoryId}
            onChange={(e) => {
              setErrors((p) => {
                const s = new Set(p);
                s.delete('subcategoryId');
                return s;
              });
              setSubcategoryId(e.target.value);
            }}
            error={errors.has('subcategoryId')}
          >
            <option value="">—</option>
            {categories.map((cat) =>
              cat.subcategories.map((sub) => (
                <option key={sub.id} value={String(sub.id)}>
                  {cat.name} › {sub.name}
                </option>
              )),
            )}
          </Select>
        </FormGroup>
        <div className="flex gap-2 pb-0.5">
          <Button variant="primary" onClick={handleSave} disabled={update.isPending}>
            {t('categorization_rules.save_btn')}
          </Button>
          <Button variant="default" onClick={() => setEditing(false)}>
            {t('categorization_rules.delete_title').slice(0, 0) || 'Annuler'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-line-subtle bg-surface hover:bg-surface-muted transition-colors">
      <div className="flex flex-col gap-0.5 min-w-0">
        <code className="text-xs text-content-secondary font-mono truncate">{rule.pattern}</code>
        <span className="text-sm text-content truncate">{subcategoryLabel}</span>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button variant="default" onClick={() => setEditing(true)}>
          Modifier
        </Button>
        <Button variant="danger" onClick={handleDelete} disabled={remove.isPending}>
          ✕
        </Button>
      </div>
    </div>
  );
}

export function CategorizationRulesCard() {
  const { t } = useTranslation('settings');
  const { data: rules = [], isLoading } = useCategorizationRules();
  const { data: categories = [] } = useCategories();
  const create = useCreateCategorizationRule();
  const deleteAll = useDeleteAllCategorizationRules();
  const initFromHistory = useInitCategorizationRulesFromHistory();

  const [newPattern, setNewPattern] = useState('');
  const [newSubcategoryId, setNewSubcategoryId] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [createErrors, setCreateErrors] = useState<Set<string>>(() => new Set());

  const subcategoryLabel = (subcategoryId: number): string => {
    for (const cat of categories) {
      const sub = cat.subcategories.find((s) => s.id === subcategoryId);
      if (sub) return `${cat.name} › ${sub.name}`;
    }
    return String(subcategoryId);
  };

  const handleCreate = () => {
    const errs = new Set<string>();
    if (!newPattern.trim()) errs.add('pattern');
    if (!newSubcategoryId) errs.add('subcategoryId');
    if (errs.size > 0) {
      setCreateErrors(errs);
      if (errs.has('pattern')) showToast(t('categorization_rules.err_pattern'));
      else showToast(t('categorization_rules.err_subcategory'));
      return;
    }
    setCreateErrors(new Set());
    create.mutate(
      { pattern: newPattern.trim(), subcategoryId: Number(newSubcategoryId) },
      {
        onSuccess: () => {
          showToast(t('categorization_rules.success_create'));
          setNewPattern('');
          setNewSubcategoryId('');
          setShowAddForm(false);
        },
      },
    );
  };

  const handleInitFromHistory = () => {
    initFromHistory.mutate(undefined, {
      onSuccess: (data) => {
        if (data.inserted === 0) {
          showToast(t('categorization_rules.init_none'));
        } else {
          showToast(t('categorization_rules.init_success', { count: data.inserted }));
        }
      },
    });
  };

  const isInitPending = initFromHistory.isPending;
  const rulesListClassName = `flex flex-col gap-2${isInitPending ? ' opacity-40 pointer-events-none' : ''}`;

  const handleDeleteAllConfirm = () => {
    deleteAll.mutate(undefined, {
      onSuccess: () => {
        showToast(t('categorization_rules.success_delete_all'));
        setShowDeleteAllConfirm(false);
      },
    });
  };

  return (
    <Card>
      <CardTitle>{t('categorization_rules.title')}</CardTitle>
      <p className="text-sm text-content-muted mb-4">{t('categorization_rules.description')}</p>

      <div className="flex gap-2 mb-4">
        <Button
          variant="primary"
          onClick={() => setShowAddForm(true)}
          disabled={showAddForm || isInitPending}
        >
          {t('categorization_rules.add_btn')}
        </Button>
        <Button variant="default" onClick={handleInitFromHistory} disabled={isInitPending}>
          {isInitPending ? '…' : t('categorization_rules.init_btn')}
        </Button>
        {rules.length > 0 && (
          <Button
            variant="danger"
            onClick={() => setShowDeleteAllConfirm(true)}
            disabled={isInitPending || deleteAll.isPending}
          >
            {t('categorization_rules.delete_all_btn')}
          </Button>
        )}
      </div>

      {showAddForm && !isInitPending && (
        <div className="flex flex-wrap gap-2 items-end p-3 rounded-xl bg-surface-muted border border-line mb-4">
          <FormGroup label={t('categorization_rules.pattern_label')} className="min-w-40 flex-1">
            <Input
              type="text"
              value={newPattern}
              onChange={(e) => {
                setCreateErrors((p) => {
                  const s = new Set(p);
                  s.delete('pattern');
                  return s;
                });
                setNewPattern(e.target.value);
              }}
              placeholder="%leclerc%"
              autoFocus
              error={createErrors.has('pattern')}
            />
          </FormGroup>
          <FormGroup
            label={t('categorization_rules.subcategory_label')}
            className="min-w-40 flex-1"
          >
            <Select
              value={newSubcategoryId}
              onChange={(e) => {
                setCreateErrors((p) => {
                  const s = new Set(p);
                  s.delete('subcategoryId');
                  return s;
                });
                setNewSubcategoryId(e.target.value);
              }}
              error={createErrors.has('subcategoryId')}
            >
              <option value="">—</option>
              {categories.map((cat) =>
                cat.subcategories.map((sub) => (
                  <option key={sub.id} value={String(sub.id)}>
                    {cat.name} › {sub.name}
                  </option>
                )),
              )}
            </Select>
          </FormGroup>
          <div className="flex gap-2 pb-0.5">
            <Button variant="primary" onClick={handleCreate} disabled={create.isPending}>
              {t('categorization_rules.save_btn')}
            </Button>
            <Button variant="default" onClick={() => setShowAddForm(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          {rules.length === 0 ? (
            <p className="text-sm text-content-faint">{t('categorization_rules.empty')}</p>
          ) : (
            <div className={rulesListClassName}>
              {rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  subcategoryLabel={subcategoryLabel(rule.subcategory_id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showDeleteAllConfirm && (
        <ConfirmModal
          title={t('categorization_rules.delete_all_confirm')}
          body={t('categorization_rules.delete_all_confirm')}
          onConfirm={handleDeleteAllConfirm}
          onCancel={() => setShowDeleteAllConfirm(false)}
          isPending={deleteAll.isPending}
        />
      )}
    </Card>
  );
}
