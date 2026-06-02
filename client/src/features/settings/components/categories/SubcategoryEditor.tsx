import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { IconButton, Input } from '@/components/ui';

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
      <Input
        type="text"
        value={nameValue}
        onChange={(e) => setNameValue(e.target.value)}
        className="flex-1"
        placeholder={resolvedPlaceholder}
        autoFocus={autoFocus}
        onKeyDown={(e) => e.key === 'Enter' && onSave(nameValue)}
      />

      {/* ACTIONS */}
      <div className="flex items-center gap-0.5 shrink-0">
        <IconButton
          label={isPending ? '...' : resolvedLabel}
          size="sm"
          disabled={isPending || !nameValue.trim()}
          onClick={() => onSave(nameValue)}
          className="text-success hover:text-success hover:bg-success-surface"
        >
          <Check size={16} strokeWidth={2.5} />
        </IconButton>
        {onCancel && (
          <IconButton label={tc('cancel')} size="sm" onClick={onCancel}>
            <X size={16} strokeWidth={2} />
          </IconButton>
        )}
      </div>
    </div>
  );
}
