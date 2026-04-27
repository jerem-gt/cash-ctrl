import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AccountBadge } from '@/components/AccountBadge';
import { AccountModal } from '@/components/AccountModal';
import { Button, Empty } from '@/components/ui';
import { useAccounts } from '@/hooks/useAccounts';
import { useAccountTypes } from '@/hooks/useAccountTypes';
import { useBanks } from '@/hooks/useBanks';
import { accountSeniority } from '@/lib/account';
import { fmtDec } from '@/lib/format';

export default function AccountsPage() {
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const { data: accountTypes = [] } = useAccountTypes();
  const { data: banks = [] } = useBanks();
  const logoMap = useMemo(() => Object.fromEntries(banks.map((b) => [b.name, b.logo])), [banks]);
  const [addOpen, setAddOpen] = useState(false);

  const groups = accountTypes
    .map((t) => ({
      type: t,
      accounts: accounts.filter((a) => a.account_type_id === t.id),
    }))
    .filter((g) => g.accounts.length > 0);

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
                      <button
                        key={acc.id}
                        onClick={() => navigate(`/accounts/${acc.id}`)}
                        className="bg-white border border-black/[0.07] rounded-2xl p-5 shadow-sm text-left hover:border-black/18 hover:shadow-md transition-all duration-150 group"
                      >
                        <div className="flex justify-between items-start mb-3 gap-2">
                          <AccountBadge
                            name={acc.name}
                            bank={acc.bank}
                            logo={logoMap[acc.bank] ?? null}
                            className="text-sm font-medium"
                          />
                          <span className="text-stone-300 group-hover:text-stone-500 transition-colors text-sm shrink-0">
                            →
                          </span>
                        </div>
                        <p
                          className={`font-serif text-3xl ${bal < 0 ? 'text-red-700' : 'text-stone-900'}`}
                        >
                          {fmtDec(bal)}
                        </p>
                        {acc.opening_date && (
                          <p className="text-[11px] text-stone-300 mt-2">
                            {accountSeniority(acc.opening_date)}
                          </p>
                        )}
                      </button>
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
    </div>
  );
}
