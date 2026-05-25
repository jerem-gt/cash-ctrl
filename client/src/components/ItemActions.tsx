import { useTranslation } from 'react-i18next';

import { IconButton } from '@/components/ui';

interface Props {
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export function ItemActions({ onEdit, onDuplicate, onDelete }: Readonly<Props>) {
  const { t } = useTranslation('common');
  return (
    <div className="flex items-center gap-0 shrink-0">
      {onEdit && (
        <IconButton label={t('edit')} size="sm" onClick={onEdit}>
          <span aria-hidden="true" className="text-[12px]">
            ✎
          </span>
        </IconButton>
      )}
      {onDuplicate && (
        <IconButton label={t('duplicate')} size="sm" onClick={onDuplicate}>
          <span aria-hidden="true" className="text-[14px]">
            ⧉
          </span>
        </IconButton>
      )}
      {onDelete && (
        <IconButton label={t('delete')} size="sm" variant="danger" onClick={onDelete}>
          <span aria-hidden="true" className="text-lg leading-none">
            ×
          </span>
        </IconButton>
      )}
    </div>
  );
}
