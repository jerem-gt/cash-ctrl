import React, { Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input } from '@/components/ui';

const EmojiPickerWidget = React.lazy(() =>
  import('./EmojiPickerWidget').then((m) => ({ default: m.EmojiPickerWidget })),
);

export type CategoryForm = { name: string; icon: string };

interface CategoryEditorProps {
  initialValues: CategoryForm;
  onSave: (values: CategoryForm) => void;
  onCancel?: () => void;
  isPending: boolean;
  submitLabel?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export function CategoryEditor({
  initialValues,
  onSave,
  onCancel,
  isPending,
  submitLabel,
  placeholder,
  autoFocus = false,
}: Readonly<CategoryEditorProps>) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const resolvedLabel = submitLabel ?? t('categories.editor_add_label');
  const resolvedPlaceholder = placeholder ?? t('categories.editor_placeholder');
  const [form, setForm] = useState(initialValues);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPicker) setShowPicker(false);
        else onCancel?.();
      }
    };
    globalThis.addEventListener('keydown', handleEsc);
    return () => globalThis.removeEventListener('keydown', handleEsc);
  }, [showPicker, onCancel]);

  return (
    <div className="flex items-center gap-2 w-full animate-in fade-in zoom-in-95 duration-200">
      {/* SÉLECTEUR EMOJI */}
      <div className="relative flex items-center shrink-0 gap-1 bg-stone-100/50 rounded-lg border border-black/3">
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="w-7 h-7 flex items-center justify-center text-base hover:bg-white rounded-md transition-all shadow-sm"
        >
          {form.icon}
        </button>

        {showPicker && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-transparent"
              onClick={() => setShowPicker(false)}
            />
            <div className="absolute top-full left-0 mt-2 z-50 shadow-2xl border border-black/5 rounded-2xl overflow-hidden animate-in slide-in-from-top-2">
              <Suspense
                fallback={
                  <div className="p-8 text-xs text-stone-400 bg-white">
                    {t('categories.loading_emoji')}
                  </div>
                }
              >
                <EmojiPickerWidget
                  onSelect={(emoji) => {
                    setForm((f) => ({ ...f, icon: emoji }));
                    setShowPicker(false);
                  }}
                />
              </Suspense>
            </div>
          </>
        )}
      </div>

      {/* NOM */}
      <Input
        aria-label={t('categories.aria_name_new')}
        type="text"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className="flex-1 min-w-0"
        placeholder={resolvedPlaceholder}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(form);
        }}
      />

      {/* ACTIONS COMPACTES */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => onSave(form)}
          disabled={isPending || !form.name.trim()}
        >
          {isPending ? '...' : resolvedLabel}
        </Button>

        {onCancel && (
          <Button type="button" variant="default" size="sm" onClick={onCancel} hidden={isPending}>
            {tc('cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}
