import type { Account } from '@cashctrl/types';
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import {
  Button,
  Card,
  ConfirmModal,
  Empty,
  IconButton,
  showToast,
  Skeleton,
  Tabs,
} from '@/components/ui';
import { type AccountFormState, AccountModal } from '@/features/accounts/components/AccountModal';
import { CloseAccountModal } from '@/features/accounts/components/CloseAccountModal';
import { LoanFormModal } from '@/features/loans/components/LoanFormModal';
import { useLoan } from '@/features/loans/hooks/useLoans';
import {
  useAccounts,
  useDeleteAccount,
  useReopenAccount,
  useUpdateAccount,
} from '@/hooks/useAccounts';
import { setGroupBy, useAccountsGroupBy } from '@/hooks/useAccountsGroupBy';
import { useAccountTypes } from '@/hooks/useAccountTypes';
import { useBanks } from '@/hooks/useBanks';
import { useLogoMap } from '@/hooks/useLogoMap';
import {
  accountDisplayBalance,
  accountSeniority,
  bankSortOrderMap,
  groupAccountsByBank,
} from '@/lib/account';
import { fmtDate, fmtDec } from '@/lib/format';
import { parseAmountOrZero, parseIdOrNull } from '@/lib/parse';

function AccountsPageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-7 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i} size="sm">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-20 shrink-0" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const { t } = useTranslation('accounts');
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const { data: accountTypes = [] } = useAccountTypes();
  const { data: banks = [] } = useBanks();
  const logoMap = useLogoMap();
  const bankSortOrder = useMemo(() => bankSortOrderMap(banks), [banks]);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoanOpen, setAddLoanOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
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
        .map((accountType) => ({
          label: accountType.name,
          accounts: activeAccounts.filter((a) => a.account_type_id === accountType.id),
        }))
        .filter((g) => g.accounts.length > 0);
    }
    return groupAccountsByBank(activeAccounts, bankSortOrder).map(({ bank, accounts }) => ({
      label: bank ?? t('page.no_bank'),
      accounts,
    }));
  }, [activeAccounts, accountTypes, groupBy, bankSortOrder, t]);

  if (accountsLoading) return <AccountsPageSkeleton />;

  const handleReopenAccount = (accountId: number) => {
    reopenAccount.mutate(accountId, {
      onSuccess: () => showToast(t('page.reopen_success')),
      onError: (err) => showToast(err.message),
    });
  };

  const handleDeleteAccount = (accountId: number) => {
    deleteAccount.mutate(accountId, {
      onSuccess: () => {
        setAccountToDelete(null);
        showToast(t('page.delete_success'));
      },
    });
  };
  const handleEditAccount = (accountId: number, data: AccountFormState) => {
    updateAccount.mutate(
      {
        id: accountId,
        name: data.name.trim(),
        bank_id: parseIdOrNull(data.bank_id),
        account_type_id: parseIdOrNull(data.account_type_id),
        initial_balance: parseAmountOrZero(data.initial_balance),
        opening_date: data.opening_date || null,
      },
      {
        onSuccess: () => {
          setAccountToEdit(null);
          showToast(t('page.edit_success'));
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl tracking-tight">{t('page.title')}</h2>
          <p className="text-sm text-content-subtle mt-0.5">{t('page.subtitle')}</p>
        </div>
        <div className="relative shrink-0">
          <Button
            variant="primary"
            size="sm"
            className="gap-1.5"
            onClick={() => setAddMenuOpen((v) => !v)}
          >
            <Plus size={15} />
            {t('page.add')}
            <ChevronDown size={14} className="opacity-80" />
          </Button>
          {addMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                aria-hidden="true"
                onClick={() => setAddMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1.5 z-20 min-w-40 bg-surface border border-line rounded-xl shadow-lg py-1 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen(true);
                    setAddMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-content-secondary hover:bg-surface-muted transition-colors"
                >
                  {t('page.add_account_menu')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddLoanOpen(true);
                    setAddMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-content-secondary hover:bg-surface-muted transition-colors"
                >
                  {t('page.add_loan_menu')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {accounts.length === 0 ? (
        <Empty>{t('page.no_accounts')}</Empty>
      ) : (
        <div className="space-y-6">
          {/* Groupement */}
          {groups.length > 0 && (
            <div className="flex justify-end">
              <Tabs
                variant="default"
                className="w-44"
                tabs={[
                  { key: 'bank', label: t('page.group_bank') },
                  { key: 'type', label: t('page.group_type') },
                ]}
                active={groupBy}
                onChange={(key) => setGroupBy(key as 'bank' | 'type')}
              />
            </div>
          )}

          {/* Comptes actifs */}
          {groups.map(({ label, accounts: groupAccounts }) => {
            const subtotal = groupAccounts.reduce(
              (sum, acc) =>
                sum +
                (acc.envelope_type === 'loan'
                  ? Math.max(0, acc.capital_restant_du ?? 0)
                  : accountDisplayBalance(acc)),
              0,
            );
            return (
              <div key={label}>
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-widest text-content-subtle">
                    {label}
                  </span>
                  <span
                    className={`font-display text-lg ${subtotal < 0 ? 'text-danger' : 'text-content-secondary'}`}
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
                      showBank={groupBy === 'type'}
                      onEdit={() =>
                        acc.envelope_type === 'loan' ? setLoanToEdit(acc) : setAccountToEdit(acc)
                      }
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
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-content-faint hover:text-content-muted transition-colors mb-3"
              >
                <Archive size={13} strokeWidth={2} />
                {t('page.closed_section', { count: closedAccounts.length })}
                {showClosed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showClosed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {closedAccounts.map((acc) => (
                    <AccountCard
                      key={acc.id}
                      acc={acc}
                      logoMap={logoMap}
                      showBank
                      onEdit={() =>
                        acc.envelope_type === 'loan' ? setLoanToEdit(acc) : setAccountToEdit(acc)
                      }
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
          title={t('page.delete_title', { name: accountToDelete.name })}
          body={t('page.delete_body')}
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
  showBank = false,
  onEdit,
  onDelete,
  onClose,
  onReopen,
}: Readonly<{
  acc: Account;
  logoMap: Record<string, string | null>;
  showBank?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose?: () => void;
  onReopen?: () => void;
}>) {
  const { t } = useTranslation('accounts');
  const isClosed = acc.closed_at !== null;
  const logo = acc.bank ? (logoMap[acc.bank] ?? null) : null;

  const displayBal =
    acc.envelope_type === 'loan' && !isClosed
      ? Math.max(0, acc.capital_restant_du ?? 0)
      : accountDisplayBalance(acc);

  const cardClass = isClosed
    ? 'bg-surface-muted border-line opacity-60 hover:opacity-80 hover:shadow-sm'
    : 'bg-surface border-line-subtle shadow-sm hover:shadow-md';

  let balanceClass: string;
  if (isClosed) {
    balanceClass = 'text-content-subtle';
  } else if (acc.envelope_type === 'loan' || displayBal < 0) {
    balanceClass = 'text-danger';
  } else {
    balanceClass = 'text-content';
  }

  return (
    <div className={`relative border rounded-2xl p-5 transition-all group ${cardClass}`}>
      <Link
        to={`/accounts/${acc.id}`}
        className="absolute inset-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        aria-label={t('page.view_transactions', { name: acc.name })}
      />
      <div className="relative z-10 flex justify-between items-start gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {logo ? (
            <img
              src={logo}
              alt={`Logo ${acc.bank}`}
              className="w-5 h-5 object-contain rounded shrink-0"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          ) : (
            acc.bank && (
              <span className="w-5 h-5 rounded bg-surface-emphasis inline-block shrink-0" />
            )
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-content leading-tight">{acc.name}</p>
            {showBank && acc.bank && (
              <p className="truncate text-[11px] text-content-subtle leading-tight">{acc.bank}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <IconButton
            label={t('page.edit_account')}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil size={18} strokeWidth={1.5} />
          </IconButton>
          {onClose && (
            <IconButton
              label={t('page.close_account')}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              <Archive size={18} strokeWidth={1.5} />
            </IconButton>
          )}
          {onReopen && (
            <IconButton
              label={t('page.reopen_account')}
              onClick={(e) => {
                e.stopPropagation();
                onReopen();
              }}
            >
              <ArchiveRestore size={18} strokeWidth={1.5} />
            </IconButton>
          )}
          <IconButton
            label={t('page.delete_account')}
            variant="danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={18} strokeWidth={1.5} />
          </IconButton>
        </div>
      </div>
      <p className={`font-display text-3xl ${balanceClass}`}>{fmtDec(displayBal)}</p>
      <div className="mt-4">
        {isClosed && acc.closed_at ? (
          <p className="text-[11px] text-content-subtle uppercase tracking-wider font-medium">
            {t('page.closed_on', { date: fmtDate(acc.closed_at) })}
          </p>
        ) : (
          acc.opening_date && (
            <p className="text-[11px] text-content-faint uppercase tracking-wider font-medium">
              {accountSeniority(acc.opening_date, t)}
            </p>
          )
        )}
      </div>
    </div>
  );
}
