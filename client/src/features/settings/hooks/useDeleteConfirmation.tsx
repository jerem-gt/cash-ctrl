import { useState } from 'react';

import { ConfirmModal } from '@/components/ui.tsx';

type PendingDelete = { title: string; body: string; onConfirm: () => void };
type DeleteMutateFn = (
  id: number,
  opts: { onSuccess: () => void; onError: (e: Error) => void },
) => void;

export function useDeleteConfirmation(showToast: (msg: string) => void) {
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const closeDelete = () => {
    setPendingDelete(null);
    setIsDeleting(false);
  };

  const requestDelete = (
    title: string,
    body: string,
    id: number,
    mutate: DeleteMutateFn,
    successMsg: string,
  ) => {
    setPendingDelete({
      title,
      body,
      onConfirm: () => {
        setIsDeleting(true);
        mutate(id, {
          onSuccess: () => {
            closeDelete();
            showToast(successMsg);
          },
          onError: (e) => {
            closeDelete();
            showToast(e.message);
          },
        });
      },
    });
  };

  function DeleteConfirmModal() {
    if (!pendingDelete) return null;

    return (
      <ConfirmModal
        title={pendingDelete.title}
        body={pendingDelete.body}
        onConfirm={pendingDelete.onConfirm}
        onCancel={closeDelete}
        isPending={isDeleting}
      />
    );
  }

  return {
    pendingDelete,
    isDeleting,
    requestDelete,
    closeDelete,
    DeleteConfirmModal,
  };
}
