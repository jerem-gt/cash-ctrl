import { useTranslation } from 'react-i18next';

interface Props {
  isEdit: boolean;
  isTransferEdit: boolean;
  isTransfer: boolean;
  noOtherAccounts: boolean;
  onToggle: (toTransfer: boolean) => void;
}

function getTransferTabClass(isTransfer: boolean, noOtherAccounts: boolean): string {
  if (isTransfer) return 'bg-stone-900 text-white';
  if (noOtherAccounts) return 'bg-stone-50 text-stone-300 cursor-not-allowed';
  return 'bg-stone-50 text-stone-400 hover:bg-stone-100';
}

export function TxModalHeader({
  isEdit,
  isTransferEdit,
  isTransfer,
  noOtherAccounts,
  onToggle,
}: Readonly<Props>) {
  const { t } = useTranslation('transactions');

  if (isEdit) {
    if (isTransferEdit) {
      return <p className="text-[11px] text-stone-400 mb-4">{t('modal.transfer_edit_note')}</p>;
    }
    return <div className="mb-4" />;
  }
  return (
    <div className="flex rounded-lg border border-black/13 overflow-hidden text-sm mb-4">
      <button
        type="button"
        onClick={() => onToggle(false)}
        className={`flex-1 py-2 font-medium transition-colors ${isTransfer ? 'bg-stone-50 text-stone-400 hover:bg-stone-100' : 'bg-stone-900 text-white'}`}
      >
        {t('modal.tab_transaction')}
      </button>
      <button
        type="button"
        onClick={() => onToggle(true)}
        disabled={noOtherAccounts}
        className={`flex-1 py-2 font-medium transition-colors ${getTransferTabClass(isTransfer, noOtherAccounts)}`}
      >
        {t('modal.tab_transfer')}
      </button>
    </div>
  );
}
