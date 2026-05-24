import type { ReactNode } from 'react';

import { Button } from './primitives';

// ─── ModalFrame ───────────────────────────────────────────────────────────────
interface ModalFrameProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}
export function ModalFrame({ title, subtitle, children }: Readonly<ModalFrameProps>) {
  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h3 className={`font-sans text-xl ${subtitle ? 'mb-1' : 'mb-5'}`}>{title}</h3>
        {subtitle !== undefined && <p className="text-sm text-stone-400 mb-5">{subtitle}</p>}
        {children}
      </div>
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
  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-sm shadow-xl">
        <h3 className="font-sans text-xl mb-2">{title}</h3>
        <p className="text-sm text-stone-500 leading-relaxed mb-6">{body}</p>
        <div className="flex gap-2 justify-end">
          <Button onClick={onCancel} disabled={isPending}>
            Annuler
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isPending}>
            {isPending ? '…' : 'Confirmer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
