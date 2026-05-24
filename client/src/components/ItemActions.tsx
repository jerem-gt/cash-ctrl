import { IconButton } from '@/components/ui';

interface Props {
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export function ItemActions({ onEdit, onDuplicate, onDelete }: Readonly<Props>) {
  return (
    <div className="flex items-center gap-0 shrink-0">
      {onEdit && (
        <IconButton label="Modifier" size="sm" onClick={onEdit}>
          <span aria-hidden="true" className="text-[12px]">
            ✎
          </span>
        </IconButton>
      )}
      {onDuplicate && (
        <IconButton label="Dupliquer" size="sm" onClick={onDuplicate}>
          <span aria-hidden="true" className="text-[14px]">
            ⧉
          </span>
        </IconButton>
      )}
      {onDelete && (
        <IconButton label="Supprimer" size="sm" variant="danger" onClick={onDelete}>
          <span aria-hidden="true" className="text-lg leading-none">
            ×
          </span>
        </IconButton>
      )}
    </div>
  );
}
