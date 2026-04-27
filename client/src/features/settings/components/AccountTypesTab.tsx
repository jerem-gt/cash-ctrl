import { SyntheticEvent, useState } from 'react';

import { ListContent } from '@/components/ListContent.tsx';
import { Button, Card, CardTitle, FormGroup, Input, showToast } from '@/components/ui.tsx';
import { RowActions } from '@/features/settings/components/RowActions.tsx';
import { useDeleteConfirmation } from '@/features/settings/hooks/useDeleteConfirmation.tsx';
import {
  useAccountTypes,
  useCreateAccountType,
  useDeleteAccountType,
  useUpdateAccountType,
} from '@/hooks/useAccountTypes.ts';
import { AccountType } from '@/types.ts';

function AccountTypeRow({
  at,
  onSaved,
  onDelete,
}: Readonly<{
  at: AccountType;
  onSaved: () => void;
  onDelete: (id: number) => void;
}>) {
  const updateAccountType = useUpdateAccountType();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(at.name);

  const handleSave = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateAccountType.mutate(
      { id: at.id, name: name.trim() },
      {
        onSuccess: () => {
          setEditing(false);
          onSaved();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="flex items-center gap-2 py-2 border-b border-black/[0.06] last:border-0"
      >
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 text-sm"
          autoFocus
        />
        <Button type="submit" variant="primary" size="sm" disabled={updateAccountType.isPending}>
          {updateAccountType.isPending ? '…' : 'OK'}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setEditing(false);
            setName(at.name);
          }}
        >
          Annuler
        </Button>
      </form>
    );
  }

  const accCount = at.acc_count ?? 0;
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-black/[0.06] last:border-0 group">
      <span className="flex-1 text-sm">{at.name}</span>
      {accCount > 0 && (
        <span className="text-[10px] text-stone-400 tabular-nums shrink-0">
          {accCount} compte(s)
        </span>
      )}
      {accCount === 0 ? (
        <RowActions onEdit={() => setEditing(true)} onDelete={() => onDelete(at.id)} />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-stone-400 hover:text-stone-700 transition-colors opacity-0 group-hover:opacity-100"
        >
          Modifier
        </button>
      )}
    </div>
  );
}

export function AccountTypesTab() {
  const { data: accountTypes = [], isLoading: atsLoading } = useAccountTypes();
  const createAccountType = useCreateAccountType();
  const deleteAccountType = useDeleteAccountType();
  const [newAtName, setNewAtName] = useState('');
  const { requestDelete, DeleteConfirmModal } = useDeleteConfirmation(showToast);

  const handleAddAccountType = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newAtName.trim()) {
      showToast('Donnez un nom au type.');
      return;
    }
    createAccountType.mutate(
      { name: newAtName.trim() },
      {
        onSuccess: () => {
          setNewAtName('');
          showToast('Type ajouté ✓');
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <Card>
      <CardTitle>Types de compte</CardTitle>
      <div className="mb-4">
        <ListContent
          isLoading={atsLoading}
          items={accountTypes}
          empty="Aucune type"
          render={(at) => (
            <AccountTypeRow
              key={at.id}
              at={at}
              onSaved={() => showToast('Type mis à jour ✓')}
              onDelete={(id) =>
                requestDelete(
                  'Supprimer le type de compte',
                  'Les comptes existants garderont leur type actuel. Confirmer ?',
                  id,
                  deleteAccountType.mutate,
                  'Type supprimé',
                )
              }
            />
          )}
        />
      </div>
      <form onSubmit={handleAddAccountType} className="flex gap-2 items-end flex-wrap">
        <FormGroup label="Nom">
          <Input
            type="text"
            value={newAtName}
            onChange={(e) => setNewAtName(e.target.value)}
            placeholder="Ex : PEA"
            className="min-w-44"
          />
        </FormGroup>
        <Button type="submit" variant="primary" disabled={createAccountType.isPending}>
          {createAccountType.isPending ? '…' : 'Ajouter'}
        </Button>
      </form>
      <DeleteConfirmModal />
    </Card>
  );
}
