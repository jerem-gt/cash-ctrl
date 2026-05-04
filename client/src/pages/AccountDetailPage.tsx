import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { CloseAccountModal } from '@/components/CloseAccountModal';
import { LoanSection } from '@/components/LoanSection';
import { PortfolioSection } from '@/components/PortfolioSection';
import { TransactionsList } from '@/components/TransactionsList';
import { useAccounts } from '@/hooks/useAccounts';
import { useBanks } from '@/hooks/useBanks';
import { useLoan, useLoanInstallments } from '@/hooks/useLoans';
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
  const isInvestment = !!account?.is_investment;
  const isLoan = !!account?.is_loan;
  const [loanCloseOpen, setLoanCloseOpen] = useState(false);

  const { data: loanData } = useLoan(isLoan ? accountId : 0);
  const { data: loanInstallments = [] } = useLoanInstallments(isLoan ? loanData?.id : undefined);
  const capitalRestantDu = useMemo(() => {
    if (!loanData) return 0;
    const paid = loanInstallments
      .filter((i) => i.transaction_validated === 1)
      .reduce((sum, i) => sum + i.principal_amount, 0);
    return Math.max(0, loanData.principal_amount - paid);
  }, [loanData, loanInstallments]);

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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex gap-5 items-start">
              {/* Conteneur Logo */}
              {account?.bank && logoMap[account.bank] && (
                <div className="shrink-0 w-14 h-14 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0,04)] border border-stone-200 flex items-center justify-center p-2.5">
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
                  {isInvestment && (
                    <>
                      <span className="text-stone-300">•</span>
                      <span className="bg-indigo-50 text-indigo-500 border border-indigo-200 text-[10px] rounded px-1.5 py-0.5 font-medium">
                        Investissement
                      </span>
                    </>
                  )}
                  {isLoan && (
                    <>
                      <span className="text-stone-300">•</span>
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] rounded px-1.5 py-0.5 font-medium">
                        Prêt
                      </span>
                    </>
                  )}
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
            {isLoan ? (
              <div className="flex flex-col items-start md:items-end bg-stone-100/40 p-4 rounded-2xl border border-stone-200/60 min-w-50">
                <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-stone-400 mb-1">
                  Capital restant dû
                </span>
                <p className="font-serif text-4xl leading-none text-red-700">
                  {fmtDec(capitalRestantDu)}
                </p>
              </div>
            ) : isInvestment ? (
              <div className="flex flex-col md:flex-row items-stretch bg-stone-100/40 p-6 rounded-2xl border border-stone-200/60 gap-5 md:gap-5">
                {/* Cash disponible */}
                <div className="flex-1 flex flex-col justify-between">
                  <span className="block text-[10px] uppercase tracking-[0.15em] font-bold text-stone-400 mb-4 whitespace-nowrap">
                    Cash disponible
                  </span>
                  <p
                    className={`font-serif text-2xl leading-none ${(account?.balance ?? 0) < 0 ? 'text-red-700' : 'text-stone-700'}`}
                  >
                    {fmtDec(account?.balance ?? 0)}
                  </p>
                </div>

                <div className="hidden md:block self-stretch w-px bg-stone-200/60" />

                {/* Portefeuille */}
                <div className="flex-1 flex flex-col justify-between">
                  <span className="block text-[10px] uppercase tracking-[0.15em] font-bold text-stone-400 mb-4 whitespace-nowrap">
                    Portefeuille
                  </span>
                  <p className="font-serif text-2xl leading-none text-stone-700">
                    {fmtDec(account?.balance_stocks ?? 0)}
                  </p>
                </div>

                <div className="hidden md:block self-stretch w-px bg-stone-200/60" />

                {/* Total */}
                <div className="flex-1 flex flex-col justify-between md:pl-2 border-t md:border-t-0 border-stone-200 pt-6 md:pt-0">
                  <span className="block text-[10px] uppercase tracking-[0.15em] font-bold text-stone-400 mb-4 whitespace-nowrap">
                    Total
                  </span>
                  <p
                    className={`font-serif text-4xl leading-none ${(account?.balance ?? 0) + (account?.balance_stocks ?? 0) < 0 ? 'text-red-700' : 'text-stone-900'}`}
                  >
                    {fmtDec((account?.balance ?? 0) + (account?.balance_stocks ?? 0))}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start md:items-end bg-stone-100/40 p-4 rounded-2xl border border-stone-200/60 min-w-50">
                <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-stone-400 mb-1">
                  Solde disponible
                </span>
                <p
                  className={`font-serif text-4xl leading-none ${(account?.balance ?? 0) < 0 ? 'text-red-700' : 'text-stone-900'}`}
                >
                  {fmtDec(account?.balance ?? 0)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Portefeuille */}
      {isInvestment && (
        <div className="px-1">
          <PortfolioSection accountId={accountId} />
        </div>
      )}

      {/* Section prêt */}
      {isLoan && account && (
        <div className="px-1">
          <LoanSection account={account} onClose={() => setLoanCloseOpen(true)} />
        </div>
      )}

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

      {loanCloseOpen && account && (
        <CloseAccountModal
          account={account}
          activeAccounts={accounts.filter((a) => !a.closed_at && a.id !== account.id)}
          onClose={() => setLoanCloseOpen(false)}
        />
      )}
    </div>
  );
}
