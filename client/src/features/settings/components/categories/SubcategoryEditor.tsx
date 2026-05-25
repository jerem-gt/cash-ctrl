import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@/components/ui';

interface CategoryEditorProps {
  name: string;
  onSave: (values: string) => void;
  onCancel?: () => void;
  isPending: boolean;
  submitLabel?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SubcategoryEditor({
  name,
  onSave,
  onCancel,
  isPending,
  submitLabel,
  placeholder,
  autoFocus = false,
}: Readonly<CategoryEditorProps>) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const resolvedLabel = submitLabel ?? 'OK';
  const resolvedPlaceholder = placeholder ?? t('categories.subcategory_placeholder');
  const [nameValue, setNameValue] = useState(name);

  return (
    <div className="flex items-center gap-2 w-full">
      {/* NOM */}
      <input
        type="text"
        value={nameValue}
        onChange={(e) => setNameValue(e.target.value)}
        className="flex-1 bg-transparent text-sm border-b border-black/10 focus:border-black outline-none py-1"
        placeholder={resolvedPlaceholder}
        autoFocus={autoFocus}
        onKeyDown={(e) => e.key === 'Enter' && onSave(nameValue)}
      />

      {/* ACTIONS */}
      <div className="flex items-center gap-0.5">
        <IconButton
          label={isPending ? '...' : resolvedLabel}
          size="sm"
          disabled={isPending || !nameValue.trim()}
          onClick={() => onSave(nameValue)}
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <span aria-hidden="true" className="text-base leading-none">
            ✓
          </span>
        </IconButton>
        {onCancel && (
          <IconButton label={tc('cancel')} size="sm" onClick={onCancel}>
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </IconButton>
        )}
      </div>
    </div>
  );
}
