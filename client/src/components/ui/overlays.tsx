import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from './primitives';
import { useModalDialog } from './useModalDialog';

// ─── ModalFrame ───────────────────────────────────────────────────────────────
type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';

const MODAL_SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
};

interface ModalFrameProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  size?: ModalSize;
  // Quand fourni, la modale se ferme sur Escape. Backdrop click non activé
  // par défaut pour éviter les fermetures accidentelles dans les longs formulaires.
  onClose?: () => void;
  footer?: ReactNode;
}

export function ModalFrame({
  title,
  subtitle,
  children,
  size = 'md',
  onClose,
  footer,
}: Readonly<ModalFrameProps>) {
  const titleId = useId();
  const dialogRef = useModalDialog(onClose);

  const hasFooter = footer !== undefined;

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        tabIndex={-1}
        onCancel={(e) => e.preventDefault()}
        className={`fixed inset-0 m-auto h-fit border-0 bg-surface text-content rounded-2xl p-7 w-[calc(100%-2rem)] backdrop:bg-transparent ${MODAL_SIZE_CLASS[size]} shadow-xl max-h-[calc(100vh-2rem)] ${hasFooter ? 'flex flex-col' : 'block overflow-y-auto'}`}
      >
        <h3 id={titleId} className={`font-display text-xl ${subtitle ? 'mb-1' : 'mb-5'} shrink-0`}>
          {title}
        </h3>
        {subtitle !== undefined && (
          <p className="text-sm text-content-subtle mb-5 shrink-0">{subtitle}</p>
        )}
        {hasFooter ? (
          <>
            <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-full">
              {children}
            </div>
            <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-line-subtle shrink-0">
              {footer}
            </div>
          </>
        ) : (
          children
        )}
      </dialog>
    </div>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
interface ConfirmModalProps {
  title: string;
  body: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}
export function ConfirmModal({
  title,
  body,
  onConfirm,
  onCancel,
  isPending,
}: Readonly<ConfirmModalProps>) {
  const { t } = useTranslation('common');
  return (
    <ModalFrame
      title={title}
      size="sm"
      onClose={isPending ? undefined : onCancel}
      footer={
        <>
          <Button onClick={onCancel} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isPending}>
            {isPending ? t('loading') : t('confirm')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-content-muted leading-relaxed">{body}</p>
    </ModalFrame>
  );
}
