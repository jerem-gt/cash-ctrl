import { Copy, Pencil, X } from 'lucide-react';
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
          <Pencil size={14} strokeWidth={1.5} />
        </IconButton>
      )}
      {onDuplicate && (
        <IconButton label={t('duplicate')} size="sm" onClick={onDuplicate}>
          <Copy size={14} strokeWidth={1.5} />
        </IconButton>
      )}
      {onDelete && (
        <IconButton label={t('delete')} size="sm" variant="danger" onClick={onDelete}>
          <X size={16} strokeWidth={2} />
        </IconButton>
      )}
    </div>
  );
}
