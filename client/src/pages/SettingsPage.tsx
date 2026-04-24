import { type ChangeEvent, type ReactNode, type SyntheticEvent, useState } from 'react';

import {
  Button,
  Card,
  CardTitle,
  ConfirmModal,
  FormGroup,
  Input,
  showToast,
  Skeleton,
} from '@/components/ui';
import {
  useAccountTypes,
  useCreateAccountType,
  useDeleteAccountType,
  useUpdateAccountType,
} from '@/hooks/useAccountTypes';
import { useChangePassword } from '@/hooks/useAuth';
import {
  useBanks,
  useCreateBank,
  useDeleteBank,
  useUpdateBank,
  useUploadBankLogo,
} from '@/hooks/useBanks';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '@/hooks/useCategories';
import {
  useCreatePaymentMethod,
  useDeletePaymentMethod,
  usePaymentMethods,
  useUpdatePaymentMethod,
} from '@/hooks/usePaymentMethods';
import type { AccountType, Bank, Category, PaymentMethod } from '@/types';

type PendingDelete = { title: string; body: string; onConfirm: () => void };
type DeleteMutateFn = (
  id: number,
  opts: { onSuccess: () => void; onError: (e: Error) => void },
) => void;

function listContent<TItem>(
  isLoading: boolean,
  items: TItem[],
  empty: string,
  render: (item: TItem) => ReactNode,
  count = 3,
) {
  if (isLoading) return <SkeletonRows count={count} />;
  if (items.length === 0) return <p className="text-sm text-stone-400 py-2">{empty}</p>;
  return items.map(render);
}

function SkeletonRows({ count = 3 }: Readonly<{ count?: number }>) {
  return (
    <div className="mb-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 py-2 border-b border-black/[0.06] last:border-0"
        >
          <Skeleton className="w-5 h-5 shrink-0" />
          <Skeleton className="h-3.5 flex-1" />
        </div>
      ))}
    </div>
  );
}

function RowActions({ onEdit, onDelete }: Readonly<{ onEdit: () => void; onDelete: () => void }>) {
  return (
    <>
      <button
        onClick={onEdit}
        className="text-xs text-stone-400 hover:text-stone-700 transition-colors opacity-0 group-hover:opacity-100"
      >
        Modifier
      </button>
      <button
        onClick={onDelete}
        className="text-xs text-stone-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
      >
        ×
      </button>
    </>
  );
}

function CategoryRow({
  cat,
  onSaved,
  onDelete,
}: Readonly<{
  cat: Category;
  onSaved: () => void;
  onDelete: (id: number) => void;
}>) {
  const updateCategory = useUpdateCategory();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: cat.name, color: cat.color });

  const handleSave = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    updateCategory.mutate(
      { id: cat.id, name: form.name.trim(), color: form.color },
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
        <input
          type="color"
          value={form.color}
          onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
          className="w-7 h-7 rounded cursor-pointer border border-black/10 p-0.5 shrink-0"
        />
        <Input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="flex-1 text-sm"
          autoFocus
        />
        <Button type="submit" variant="primary" size="sm" disabled={updateCategory.isPending}>
          {updateCategory.isPending ? '…' : 'OK'}
        </Button>
        <Button type="button" size="sm" onClick={() => setEditing(false)}>
          Annuler
        </Button>
      </form>
    );
  }

  const txCount = cat.tx_count ?? 0;
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-black/[0.06] last:border-0 group">
      <div className="w-3.5 h-3.5 rounded-sm shrink-0" style={{ background: cat.color }} />
      <span className="flex-1 text-sm">{cat.name}</span>
      {txCount > 0 && (
        <span className="text-[10px] text-stone-400 tabular-nums shrink-0">{txCount} tx</span>
      )}
      {txCount === 0 ? (
        <RowActions
          onEdit={() => {
            setForm({ name: cat.name, color: cat.color });
            setEditing(true);
          }}
          onDelete={() => onDelete(cat.id)}
        />
      ) : (
        <button
          onClick={() => {
            setForm({ name: cat.name, color: cat.color });
            setEditing(true);
          }}
          className="text-xs text-stone-400 hover:text-stone-700 transition-colors opacity-0 group-hover:opacity-100"
        >
          Modifier
        </button>
      )}
    </div>
  );
}

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

function PaymentMethodRow({
  pm,
  onSaved,
  onDelete,
}: Readonly<{
  pm: PaymentMethod;
  onSaved: () => void;
  onDelete: (id: number) => void;
}>) {
  const updatePm = useUpdatePaymentMethod();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: pm.name, icon: pm.icon });

  const handleSave = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    updatePm.mutate(
      { id: pm.id, name: form.name.trim(), icon: form.icon },
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
          value={form.icon}
          onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
          className="w-14 text-center text-lg"
          placeholder="🔸"
        />
        <Input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="flex-1 text-sm"
          autoFocus
        />
        <Button type="submit" variant="primary" size="sm" disabled={updatePm.isPending}>
          {updatePm.isPending ? '…' : 'OK'}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setEditing(false);
            setForm({ name: pm.name, icon: pm.icon });
          }}
        >
          Annuler
        </Button>
      </form>
    );
  }

  const txCount = pm.tx_count ?? 0;
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-black/[0.06] last:border-0 group">
      <span className="w-5 text-center text-base leading-none">{pm.icon}</span>
      <span className="flex-1 text-sm">{pm.name}</span>
      {txCount > 0 && (
        <span className="text-[10px] text-stone-400 tabular-nums shrink-0">{txCount} tx</span>
      )}
      {txCount === 0 ? (
        <RowActions onEdit={() => setEditing(true)} onDelete={() => onDelete(pm.id)} />
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

export function SettingsPage() {
  const changePassword = useChangePassword();
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });

  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const [newCat, setNewCat] = useState({ name: '', color: '#9E9A92' });

  const { data: accountTypes = [], isLoading: atsLoading } = useAccountTypes();
  const createAccountType = useCreateAccountType();
  const deleteAccountType = useDeleteAccountType();
  const [newAtName, setNewAtName] = useState('');

  const { data: banks = [], isLoading: banksLoading } = useBanks();
  const createBank = useCreateBank();
  const deleteBank = useDeleteBank();
  const [newBank, setNewBank] = useState({ name: '', domain: '' });

  const { data: paymentMethods = [], isLoading: pmsLoading } = usePaymentMethods();
  const createPaymentMethod = useCreatePaymentMethod();
  const deletePaymentMethod = useDeletePaymentMethod();
  const [newPm, setNewPm] = useState({ name: '', icon: '' });

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

  const handlePasswordSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      showToast('Les mots de passe ne correspondent pas.');
      return;
    }
    if (pwForm.next.length < 8) {
      showToast('Minimum 8 caractères.');
      return;
    }
    changePassword.mutate(
      { current: pwForm.current, next: pwForm.next },
      {
        onSuccess: () => {
          setPwForm({ current: '', next: '', confirm: '' });
          showToast('Mot de passe mis à jour ✓');
        },
        onError: (e) => showToast(e.message),
      },
    );
  };

  const handleAddCategory = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newCat.name.trim()) {
      showToast('Donnez un nom à la catégorie.');
      return;
    }
    createCategory.mutate(
      { name: newCat.name.trim(), color: newCat.color },
      {
        onSuccess: () => {
          setNewCat({ name: '', color: '#9E9A92' });
          showToast('Catégorie ajoutée ✓');
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

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

  const handleAddPaymentMethod = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newPm.name.trim()) {
      showToast('Donnez un nom au moyen de paiement.');
      return;
    }
    createPaymentMethod.mutate(
      { name: newPm.name.trim(), icon: newPm.icon },
      {
        onSuccess: () => {
          setNewPm({ name: '', icon: '' });
          showToast('Moyen de paiement ajouté ✓');
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">Paramètres</h2>
        <p className="text-sm text-stone-400 mt-0.5">Gestion du compte</p>
      </div>

      {/* Banks */}
      <Card>
        <CardTitle>Banques</CardTitle>
        <div className="mb-4">
          {listContent(banksLoading, banks, 'Aucune banque.', (b) => (
            <BankRow
              key={b.id}
              bank={b}
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
          ))}
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
      </Card>

      {/* Account types */}
      <Card>
        <CardTitle>Types de compte</CardTitle>
        <div className="mb-4">
          {listContent(atsLoading, accountTypes, 'Aucun type.', (at) => (
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
          ))}
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
      </Card>

      {/* Payment methods */}
      <Card>
        <CardTitle>Moyens de paiement</CardTitle>
        <div className="mb-4">
          {listContent(pmsLoading, paymentMethods, 'Aucun moyen de paiement.', (pm) => (
            <PaymentMethodRow
              key={pm.id}
              pm={pm}
              onSaved={() => showToast('Moyen de paiement mis à jour ✓')}
              onDelete={(id) =>
                requestDelete(
                  'Supprimer le moyen de paiement',
                  'Confirmer la suppression ?',
                  id,
                  deletePaymentMethod.mutate,
                  'Moyen de paiement supprimé',
                )
              }
            />
          ))}
        </div>
        <form onSubmit={handleAddPaymentMethod} className="flex gap-2 items-end flex-wrap">
          <FormGroup label="Icône">
            <Input
              type="text"
              value={newPm.icon}
              onChange={(e) => setNewPm((f) => ({ ...f, icon: e.target.value }))}
              placeholder="💶"
              className="w-16 text-center text-lg"
            />
          </FormGroup>
          <FormGroup label="Nom">
            <Input
              type="text"
              value={newPm.name}
              onChange={(e) => setNewPm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex : Espèces"
              className="min-w-44"
            />
          </FormGroup>
          <Button type="submit" variant="primary" disabled={createPaymentMethod.isPending}>
            {createPaymentMethod.isPending ? '…' : 'Ajouter'}
          </Button>
        </form>
      </Card>

      {/* Categories */}
      <Card>
        <CardTitle>Catégories</CardTitle>
        <div className="mb-4">
          {listContent(
            catsLoading,
            categories,
            'Aucune catégorie.',
            (cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                onSaved={() => showToast('Catégorie mise à jour ✓')}
                onDelete={(id) =>
                  requestDelete(
                    'Supprimer la catégorie',
                    'Confirmer la suppression ?',
                    id,
                    deleteCategory.mutate,
                    'Catégorie supprimée',
                  )
                }
              />
            ),
            4,
          )}
        </div>
        <form onSubmit={handleAddCategory} className="flex gap-2 items-end flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="color" className="text-xs text-stone-500 font-medium">
              Couleur
            </label>
            <input
              id="color"
              type="color"
              value={newCat.color}
              onChange={(e) => setNewCat((f) => ({ ...f, color: e.target.value }))}
              className="w-7 h-7 rounded cursor-pointer border border-black/10 p-0.5"
            />
          </div>
          <FormGroup label="Nom">
            <Input
              type="text"
              value={newCat.name}
              onChange={(e) => setNewCat((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex : Vacances"
              className="min-w-44"
            />
          </FormGroup>
          <Button type="submit" variant="primary" disabled={createCategory.isPending}>
            {createCategory.isPending ? '…' : 'Ajouter'}
          </Button>
        </form>
      </Card>

      {/* Password */}
      <Card className="max-w-sm">
        <CardTitle>Changer le mot de passe</CardTitle>
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <FormGroup label="Mot de passe actuel">
            <Input
              type="password"
              value={pwForm.current}
              onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
              autoComplete="current-password"
            />
          </FormGroup>
          <FormGroup label="Nouveau mot de passe">
            <Input
              type="password"
              value={pwForm.next}
              onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
              placeholder="Min. 8 caractères"
              autoComplete="new-password"
            />
          </FormGroup>
          <FormGroup label="Confirmer">
            <Input
              type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
              autoComplete="new-password"
            />
          </FormGroup>
          <Button
            type="submit"
            variant="primary"
            disabled={changePassword.isPending}
            className="mt-2"
          >
            {changePassword.isPending ? '…' : 'Mettre à jour'}
          </Button>
        </form>
      </Card>

      {pendingDelete && (
        <ConfirmModal
          title={pendingDelete.title}
          body={pendingDelete.body}
          onConfirm={pendingDelete.onConfirm}
          onCancel={() => setPendingDelete(null)}
          isPending={isDeleting}
        />
      )}
    </div>
  );
}
