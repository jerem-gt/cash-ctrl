import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AccountBadge } from '@/components/AccountBadge';
import { type AccountFormState, AccountModal } from '@/components/AccountModal';
import { CloseAccountModal } from '@/components/CloseAccountModal';
import { LoanFormModal } from '@/components/LoanFormModal';
import { Button, ConfirmModal, Empty, showToast } from '@/components/ui';
import {
  useAccounts,
  useDeleteAccount,
  useReopenAccount,
  useUpdateAccount,
} from '@/hooks/useAccounts';
import { setGroupBy, useAccountsGroupBy } from '@/hooks/useAccountsGroupBy';
import { useAccountTypes } from '@/hooks/useAccountTypes';
import { useBanks } from '@/hooks/useBanks';
import { useLoan } from '@/hooks/useLoans';
import { accountSeniority } from '@/lib/account';
import { fmtDate, fmtDec } from '@/lib/format';
import type { Account } from '@/types.ts';

export default function AccountsPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: accountTypes = [] } = useAccountTypes();
  const { data: banks = [] } = useBanks();
  const logoMap = useMemo(() => Object.fromEntries(banks.map((b) => [b.name, b.logo])), [banks]);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoanOpen, setAddLoanOpen] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const deleteAccount = useDeleteAccount();
  const updateAccount = useUpdateAccount();
  const reopenAccount = useReopenAccount();
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
  const [loanToEdit, setLoanToEdit] = useState<Account | null>(null);
  const { data: loanToEditData } = useLoan(loanToEdit?.id ?? 0);
  const [accountToClose, setAccountToClose] = useState<Account | null>(null);
  const groupBy = useAccountsGroupBy();

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.closed_at), [accounts]);
  const closedAccounts = useMemo(() => accounts.filter((a) => !!a.closed_at), [accounts]);

  const groups = useMemo(() => {
    if (groupBy === 'type') {
      return accountTypes
        .map((t) => ({
          label: t.name,
          accounts: activeAccounts.filter((a) => a.account_type_id === t.id),
        }))
        .filter((g) => g.accounts.length > 0);
    }
    const map = new Map<string, Account[]>();
    for (const acc of activeAccounts) {
      const key = acc.bank ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(acc);
    }
    return [...map.entries()]
      .sort(([a], [b]) => {
        if (a === '') return 1;
        if (b === '') return -1;
        return a.localeCompare(b);
      })
      .map(([key, accs]) => ({ label: key === '' ? 'Sans banque' : key, accounts: accs }));
  }, [activeAccounts, accountTypes, groupBy]);

  const handleReopenAccount = (accountId: number) => {
    reopenAccount.mutate(accountId, {
      onSuccess: () => showToast('Compte réouvert ✓'),
      onError: (err) => showToast(err.message),
    });
  };

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
        opening_date: data.opening_date || null,
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
          <h2 className="font-sans text-2xl tracking-tight">Comptes</h2>
          <p className="text-sm text-stone-400 mt-0.5">
            Cliquez sur un compte pour voir ses transactions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-stone-100 rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setGroupBy('bank')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                groupBy === 'bank'
                  ? 'bg-white text-stone-800 shadow-sm font-medium'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Banque
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('type')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                groupBy === 'type'
                  ? 'bg-white text-stone-800 shadow-sm font-medium'
                  : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              Type
            </button>
          </div>
          <Button size="sm" onClick={() => setAddLoanOpen(true)}>
            + Nouveau prêt
          </Button>
          <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            + Nouveau compte
          </Button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <Empty>Aucun compte pour l'instant.</Empty>
      ) : (
        <div className="space-y-6">
          {/* Comptes actifs */}
          {groups.map(({ label, accounts: groupAccounts }) => {
            const subtotal = groupAccounts.reduce(
              (sum, acc) =>
                sum + (acc.is_loan ? Math.max(0, acc.capital_restant_du ?? 0) : acc.balance),
              0,
            );
            return (
              <div key={label}>
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                    {label}
                  </span>
                  <span
                    className={`font-sans text-lg ${subtotal < 0 ? 'text-red-700' : 'text-stone-700'}`}
                  >
                    {fmtDec(subtotal)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupAccounts.map((acc) => (
                    <AccountCard
                      key={acc.id}
                      acc={acc}
                      logoMap={logoMap}
                      onEdit={() => (acc.is_loan ? setLoanToEdit(acc) : setAccountToEdit(acc))}
                      onDelete={() => setAccountToDelete(acc)}
                      onClose={() => setAccountToClose(acc)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Section comptes clôturés */}
          {closedAccounts.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowClosed((v) => !v)}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-stone-300 hover:text-stone-500 transition-colors mb-3"
              >
                <Archive size={13} strokeWidth={2} />
                Comptes clôturés ({closedAccounts.length})
                <span className="font-normal normal-case tracking-normal">
                  {showClosed ? '▴' : '▾'}
                </span>
              </button>
              {showClosed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {closedAccounts.map((acc) => (
                    <ClosedAccountCard
                      key={acc.id}
                      acc={acc}
                      logoMap={logoMap}
                      onDelete={() => setAccountToDelete(acc)}
                      onReopen={() => handleReopenAccount(acc.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
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
      {addLoanOpen && <LoanFormModal mode="create" onClose={() => setAddLoanOpen(false)} />}
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
      {accountToClose && (
        <CloseAccountModal
          account={accountToClose}
          activeAccounts={activeAccounts}
          onClose={() => setAccountToClose(null)}
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
      {loanToEdit && loanToEditData && (
        <LoanFormModal
          mode="edit"
          account={loanToEdit}
          loan={loanToEditData}
          onClose={() => setLoanToEdit(null)}
        />
      )}
    </div>
  );
}

function AccountCard({
  acc,
  logoMap,
  onEdit,
  onDelete,
  onClose,
}: Readonly<{
  acc: Account;
  logoMap: Record<string, string | null>;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}>) {
  const bal = acc.balance;
  const displayBal = acc.is_loan ? Math.max(0, acc.capital_restant_du ?? 0) : bal;
  return (
    <div className="relative bg-white border border-black/[0.07] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
      <div className="relative z-10 pointer-events-none flex justify-between items-start mb-3">
        <AccountBadge name={acc.name} bank={acc.bank} logo={logoMap[acc.bank] ?? null} />
        <div className="flex gap-1 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
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
              onClose();
            }}
            className="p-2 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
            title="Clôturer le compte"
          >
            <Archive size={18} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title="Supprimer le compte"
          >
            <Trash2 size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <p
        className={`font-sans text-3xl ${acc.is_loan || bal < 0 ? 'text-red-700' : 'text-stone-900'}`}
      >
        {fmtDec(displayBal)}
      </p>
      <div className="flex justify-between items-center mt-4">
        {acc.opening_date && (
          <p className="text-[11px] text-stone-300 uppercase tracking-wider font-medium">
            {accountSeniority(acc.opening_date)}
          </p>
        )}
      </div>
    </div>
  );
}

function ClosedAccountCard({
  acc,
  logoMap,
  onReopen,
  onDelete,
}: Readonly<{
  acc: Account;
  logoMap: Record<string, string | null>;
  onReopen: () => void;
  onDelete: () => void;
}>) {
  return (
    <div className="relative bg-stone-50 border border-stone-200 rounded-2xl p-5 opacity-60">
      <div className="flex justify-between items-start mb-3">
        <AccountBadge name={acc.name} bank={acc.bank} logo={logoMap[acc.bank] ?? null} />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReopen();
            }}
            className="p-2 text-stone-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
            title="Rouvrir le compte"
          >
            <ArchiveRestore size={18} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title="Supprimer le compte"
          >
            <Trash2 size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <p className="font-sans text-3xl text-stone-400">{fmtDec(acc.balance)}</p>
      {acc.closed_at && (
        <p className="text-[11px] text-stone-400 uppercase tracking-wider font-medium mt-4">
          Clôturé le {fmtDate(acc.closed_at)}
        </p>
      )}
    </div>
  );
}
