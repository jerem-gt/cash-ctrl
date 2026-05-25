import { useTranslation } from 'react-i18next';

export function RowActions({
  onEdit,
  onDelete,
}: Readonly<{ onEdit: () => void; onDelete: () => void }>) {
  const { t } = useTranslation('settings');
  return (
    <>
      <button
        onClick={onEdit}
        className="text-xs text-stone-400 hover:text-stone-700 transition-colors opacity-0 group-hover:opacity-100"
      >
        {t('row_actions.edit')}
      </button>
      <button
        onClick={onDelete}
        className="text-xs text-stone-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
      >
        {t('row_actions.delete')}
      </button>
    </>
  );
}
