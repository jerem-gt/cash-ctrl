import { ChangeEvent, SyntheticEvent, useState } from 'react';

import { ListContent } from '@/components/ListContent.tsx';
import { Button, Card, CardTitle, FormGroup, Input, showToast } from '@/components/ui.tsx';
import { RowActions } from '@/features/settings/components/RowActions.tsx';
import { useDeleteConfirmation } from '@/features/settings/hooks/useDeleteConfirmation.tsx';
import {
  useBanks,
  useCreateBank,
  useDeleteBank,
  useUpdateBank,
  useUploadBankLogo,
} from '@/hooks/useBanks.ts';
import { Bank } from '@/types.ts';

function BankRow({
  bank,
  onSaved,
  onDelete,
}: Readonly<{
  bank: Bank;
  onSaved: () => void;
  onDelete: (id: number) => void;
}>) {
  const updateBank = useUpdateBank();
  const uploadLogo = useUploadBankLogo();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(bank.name);
  const [domain, setDomain] = useState(bank.domain ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
    setFile(f);
  };

  const handleSave = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      if (file) await uploadLogo.mutateAsync({ id: bank.id, file });
      await updateBank.mutateAsync({
        id: bank.id,
        name: name.trim(),
        domain: domain.trim() || null,
      });
      setEditing(false);
      setFile(null);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      onSaved();
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setName(bank.name);
    setDomain(bank.domain ?? '');
    setFile(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  if (editing) {
    const logoSrc = preview ?? bank.logo ?? null;
    return (
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-2 py-3 border-b border-black/[0.06] last:border-0"
      >
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-sm"
          placeholder="Nom"
          autoFocus
        />
        <Input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="text-sm"
          placeholder="Domaine (ex : boursobank.com)"
        />
        <div className="flex items-center gap-2">
          {logoSrc && (
            <img
              src={logoSrc}
              alt=""
              className="w-6 h-6 object-contain rounded shrink-0"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}
          <label className="flex-1 cursor-pointer">
            <span className="text-xs text-stone-400">{file ? file.name : 'Choisir un logo…'}</span>
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={updateBank.isPending || uploadLogo.isPending}
          >
            {updateBank.isPending || uploadLogo.isPending ? '…' : 'OK'}
          </Button>
          <Button type="button" size="sm" onClick={cancelEdit}>
            Annuler
          </Button>
        </div>
      </form>
    );
  }

  const accCount = bank.acc_count ?? 0;
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-black/[0.06] last:border-0 group">
      {bank.logo ? (
        <img
          src={bank.logo}
          alt=""
          className="w-5 h-5 object-contain rounded shrink-0"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      ) : (
        <div className="w-5 h-5 rounded bg-stone-100 shrink-0" />
      )}
      <span className="flex-1 text-sm">{bank.name}</span>
      {accCount > 0 && (
        <span className="text-[10px] text-stone-400 tabular-nums shrink-0">
          {accCount} compte(s)
        </span>
      )}
      {accCount === 0 ? (
        <RowActions onEdit={() => setEditing(true)} onDelete={() => onDelete(bank.id)} />
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

export function BanksTab() {
  const { data: banks = [], isLoading: banksLoading } = useBanks();
  const createBank = useCreateBank();
  const deleteBank = useDeleteBank();
  const [newBank, setNewBank] = useState({ name: '', domain: '' });
  const { requestDelete, DeleteConfirmModal } = useDeleteConfirmation(showToast);

  const handleAddBank = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newBank.name.trim()) {
      showToast('Donnez un nom à la banque.');
      return;
    }
    createBank.mutate(
      { name: newBank.name.trim(), domain: newBank.domain.trim() || null },
      {
        onSuccess: () => {
          setNewBank({ name: '', domain: '' });
          showToast('Banque ajoutée ✓');
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <Card>
      <CardTitle>Banques</CardTitle>
      <div className="mb-4">
        <ListContent
          isLoading={banksLoading}
          items={banks}
          empty="Aucune banque"
          render={(bank) => (
            <BankRow
              key={bank.id}
              bank={bank}
              onSaved={() => showToast('Banque mise à jour ✓')}
              onDelete={(id) =>
                requestDelete(
                  'Supprimer la banque',
                  'Les comptes existants garderont leur banque actuelle. Confirmer ?',
                  id,
                  deleteBank.mutate,
                  'Banque supprimée',
                )
              }
            />
          )}
        />
      </div>
      <form onSubmit={handleAddBank} className="flex gap-2 items-end flex-wrap">
        <FormGroup label="Nom">
          <Input
            type="text"
            value={newBank.name}
            onChange={(e) => setNewBank((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ex : Fortuneo"
            className="min-w-44"
          />
        </FormGroup>
        <FormGroup label="Domaine">
          <Input
            type="text"
            value={newBank.domain}
            onChange={(e) => setNewBank((f) => ({ ...f, domain: e.target.value }))}
            placeholder="Ex : fortuneo.fr"
            className="min-w-44"
          />
        </FormGroup>
        <Button type="submit" variant="primary" disabled={createBank.isPending}>
          {createBank.isPending ? '…' : 'Ajouter'}
        </Button>
      </form>
      <DeleteConfirmModal />
    </Card>
  );
}
