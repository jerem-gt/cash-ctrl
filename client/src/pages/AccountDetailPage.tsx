import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { TransactionsList } from '@/components/TransactionsList';
import { useAccounts } from '@/hooks/useAccounts';
import { useBanks } from '@/hooks/useBanks';
import { accountSeniority } from '@/lib/account';
import { fmtDec } from '@/lib/format';

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const accountId = Number.parseInt(id ?? '0');
  const navigate = useNavigate();

  const { data: accounts = [] } = useAccounts();
  const { data: banks = [] } = useBanks();
  const logoMap = useMemo(() => Object.fromEntries(banks.map((b) => [b.name, b.logo])), [banks]);

  const account = accounts.find((a) => a.id === accountId);

  if (!account && accounts.length > 0) {
    return (
      <div className="space-y-5">
        <button
          onClick={() => navigate('/accounts')}
          className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
        >
          ← Comptes
        </button>
        <p className="text-sm text-stone-400">Compte introuvable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="p-8 bg-[#fafaf9] border-b border-stone-200">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="flex gap-5 items-start">
              {/* Conteneur Logo */}
              {account?.bank && logoMap[account.bank] && (
                <div className="flex-shrink-0 w-14 h-14 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0,04)] border border-stone-200 flex items-center justify-center p-2.5">
                  <img
                    src={logoMap[account.bank]!}
                    alt={`Logo ${account.bank}`}
                    className="w-full h-full object-contain"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-stone-500 font-medium text-xs tracking-wide">
                  <span className="uppercase">{account?.bank}</span>
                  <span className="text-stone-300">•</span>
                  <span>{account?.type}</span>
                </div>

                <h2 className="font-serif text-4xl text-stone-900 tracking-tight">
                  {account?.name ?? 'Compte'}
                </h2>

                {account?.opening_date && (
                  <p className="text-sm text-stone-500 font-medium">
                    <span className="text-stone-400">Ouvert le</span>{' '}
                    {new Date(account.opening_date + 'T00:00:00').toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    <span className="mx-2 text-stone-300">—</span>
                    <span className="bg-stone-200/50 text-stone-600 px-2 py-0.5 rounded text-[11px] uppercase tracking-wider">
                      {accountSeniority(account.opening_date)}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Section Solde */}
            <div className="flex flex-col items-start md:items-end bg-stone-100/40 p-4 rounded-2xl border border-stone-200/60 min-w-[200px]">
              <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-stone-400 mb-1">
                Solde disponible
              </span>
              <p
                className={`font-serif text-4xl leading-none ${(account?.balance ?? 0) < 0 ? 'text-red-700' : 'text-stone-900'}`}
              >
                {fmtDec(account?.balance ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction list */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
          Transactions
        </p>
      </div>
      <TransactionsList
        key={account?.id}
        account={account}
        logoMap={logoMap}
        emptyMessage="Aucune transaction sur ce compte"
      />
    </div>
  );
}
