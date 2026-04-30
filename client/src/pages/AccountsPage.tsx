import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AccountBadge } from '@/components/AccountBadge';
import { type AccountFormState, AccountModal } from '@/components/AccountModal';
import { Button, ConfirmModal, Empty, showToast } from '@/components/ui';
import { useAccounts, useDeleteAccount, useUpdateAccount } from '@/hooks/useAccounts';
import { useAccountTypes } from '@/hooks/useAccountTypes';
import { useBanks } from '@/hooks/useBanks';
import { accountSeniority } from '@/lib/account';
import { fmtDec } from '@/lib/format';
import type { Account } from '@/types.ts';

export default function AccountsPage() {
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const { data: accountTypes = [] } = useAccountTypes();
  const { data: banks = [] } = useBanks();
  const logoMap = useMemo(() => Object.fromEntries(banks.map((b) => [b.name, b.logo])), [banks]);
  const [addOpen, setAddOpen] = useState(false);
  const deleteAccount = useDeleteAccount();
  const updateAccount = useUpdateAccount();
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);

  const groups = accountTypes
    .map((t) => ({
      type: t,
      accounts: accounts.filter((a) => a.account_type_id === t.id),
    }))
    .filter((g) => g.accounts.length > 0);

  const handleDeleteAccount = (accountId: number) => {
    deleteAccount.mutate(accountId, {
      onSuccess: () => {
        setAccountToDelete(null);
        showToast('Compte supprimé');
      },
    });
  };
  const handleEditAccount = (accountId: number, data: AccountFormState) => {
    updateAccount.mutate(
      {
        id: accountId,
        name: data.name.trim(),
        bank_id: Number.parseInt(data.bank_id) || null,
        account_type_id: Number.parseInt(data.account_type_id) || null,
        initial_balance: Number.parseFloat(data.initial_balance) || 0,
        opening_date: data.opening_date,
      },
      {
        onSuccess: () => {
          setAccountToEdit(null);
          showToast('Compte mis à jour ✓');
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-serif text-2xl tracking-tight">Comptes</h2>
          <p className="text-sm text-stone-400 mt-0.5">
            Cliquez sur un compte pour voir ses transactions
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
          + Nouveau compte
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Empty>Aucun compte pour l'instant.</Empty>
      ) : (
        <div className="space-y-6">
          {groups.map(({ type, accounts: groupAccounts }) => {
            const subtotal = groupAccounts.reduce((sum, acc) => sum + acc.balance, 0);
            return (
              <div key={type.id}>
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                    {type.name}
                  </span>
                  <span
                    className={`font-serif text-lg ${subtotal < 0 ? 'text-red-700' : 'text-stone-700'}`}
                  >
                    {fmtDec(subtotal)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupAccounts.map((acc) => {
                    const bal = acc.balance;
                    return (
                      <div
                        key={acc.id}
                        className="relative bg-white border border-black/[0.07] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group"
                      >
                        {/* 1. Le bouton principal qui couvre TOUTE la carte */}
                        <button
                          type="button"
                          onClick={() => navigate(`/accounts/${acc.id}`)}
                          className="absolute inset-0 w-full h-full cursor-pointer rounded-2xl z-0"
                          aria-label={`Accéder au compte ${acc.name}`}
                        />

                        {/* 2. Le contenu visuel (on ajoute pointer-events-none pour que le clic passe à travers vers le bouton du dessous) */}
                        <div className="relative z-10 pointer-events-none flex justify-between items-start mb-3">
                          <AccountBadge
                            name={acc.name}
                            bank={acc.bank}
                            logo={logoMap[acc.bank] ?? null}
                          />

                          {/* 3. Groupe d'actions (On réactive le clic ici) */}
                          <div className="flex gap-1 pointer-events-auto">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAccountToEdit(acc);
                              }}
                              className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all"
                              title="Modifier le compte"
                            >
                              <Pencil size={18} strokeWidth={1.5} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAccountToDelete(acc);
                              }}
                              className="pointer-events-auto p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                              title="Supprimer le compte"
                            >
                              <Trash2 size={18} strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>

                        <p
                          className={`font-serif text-3xl ${bal < 0 ? 'text-red-700' : 'text-stone-900'}`}
                        >
                          {fmtDec(bal)}
                        </p>

                        <div className="flex justify-between items-center mt-4">
                          {acc.opening_date && (
                            <p className="text-[11px] text-stone-300 uppercase tracking-wider font-medium">
                              {accountSeniority(acc.opening_date)}
                            </p>
                          )}
                          <ChevronRight
                            size={16}
                            className="text-stone-300 group-hover:text-stone-500 group-hover:translate-x-1 transition-all"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addOpen && (
        <AccountModal
          mode="create"
          banks={banks}
          accountTypes={accountTypes}
          onClose={() => setAddOpen(false)}
        />
      )}
      {accountToEdit && (
        <AccountModal
          mode="edit"
          account={accountToEdit}
          banks={banks}
          accountTypes={accountTypes}
          onSave={(data: AccountFormState) => handleEditAccount(accountToEdit.id, data)}
          onClose={() => setAccountToEdit(null)}
          isPending={updateAccount.isPending}
        />
      )}
      {accountToDelete && (
        <ConfirmModal
          title={`Supprimer le compte ${accountToDelete.name}`}
          body="Toutes les transactions associées seront supprimées. Cette action est irréversible."
          onConfirm={() => handleDeleteAccount(accountToDelete.id)}
          onCancel={() => setAccountToDelete(null)}
        />
      )}
    </div>
  );
}
