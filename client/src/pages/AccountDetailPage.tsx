import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AccountHeader } from '@/components/AccountHeader.tsx';
import { CloseAccountModal } from '@/components/CloseAccountModal';
import { InsuranceSection } from '@/components/InsuranceSection';
import { LoanSection } from '@/components/LoanSection';
import { PortfolioSection } from '@/components/PortfolioSection';
import { ProfitabilityCard } from '@/components/ProfitabilityCard';
import { TransactionsList } from '@/components/TransactionsList';
import { Skeleton } from '@/components/ui';
import { useAccounts } from '@/hooks/useAccounts';
import { useBanks } from '@/hooks/useBanks';
import { useLoan, useLoanInstallments } from '@/hooks/useLoans';
import { useProfitability } from '@/hooks/useStats';

function AccountDetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="p-8 bg-[#fafaf9] border-b border-stone-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex gap-5 items-start">
            <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
            <div className="space-y-2.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-9 w-52" />
              <Skeleton className="h-4 w-44" />
            </div>
          </div>
          <Skeleton className="h-16 w-48 rounded-2xl shrink-0" />
        </div>
      </div>
      <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
        Transactions
      </p>
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 border rounded-xl border-black/[0.07] bg-white"
          >
            <Skeleton className="w-4 h-4 shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const accountId = Number.parseInt(id ?? '0');
  const navigate = useNavigate();

  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const { data: banks = [] } = useBanks();
  const logoMap = useMemo(() => Object.fromEntries(banks.map((b) => [b.name, b.logo])), [banks]);

  const account = accounts.find((a) => a.id === accountId);
  const isInvestment = account?.envelope_type === 'investment';
  const isInsurance =
    account?.envelope_type === 'life_insurance' || account?.envelope_type === 'per';
  const isLoan = account?.envelope_type === 'loan';
  const isClosed = !!account?.closed_at;
  const [temporarilyUnlocked, setTemporarilyUnlocked] = useState(false);
  const readOnly = isClosed && !temporarilyUnlocked;
  const [loanCloseOpen, setLoanCloseOpen] = useState(false);

  const { data: profitabilityList = [] } = useProfitability();
  const profitability = profitabilityList.find((p) => p.account_id === accountId);
  const showProfitability = isInvestment || isInsurance || account?.type === 'Épargne';

  const { data: loanData } = useLoan(isLoan ? accountId : 0);
  const { data: loanInstallments = [] } = useLoanInstallments(isLoan ? loanData?.id : undefined);
  const capitalRestantDu = useMemo(() => {
    if (!loanData) return 0;
    const paid = loanInstallments
      .filter((i) => i.transaction_validated === 1)
      .reduce((sum, i) => sum + i.principal_amount, 0);
    return Math.max(0, loanData.principal_amount - paid);
  }, [loanData, loanInstallments]);

  if (accountsLoading) return <AccountDetailSkeleton />;

  if (!account) {
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
      <AccountHeader
        account={account}
        logoMap={logoMap}
        isInvestment={isInvestment}
        isInsurance={isInsurance}
        isLoan={isLoan}
        capitalRestantDu={capitalRestantDu}
      />

      {/* Rendement */}
      {showProfitability && profitability && (
        <div className="px-1">
          <ProfitabilityCard data={profitability} />
        </div>
      )}

      {/* Portefeuille bourse */}
      {isInvestment && (
        <div className="px-1">
          <PortfolioSection accountId={accountId} readOnly={readOnly} />
        </div>
      )}

      {/* Enveloppe assurance */}
      {isInsurance && (
        <div className="px-1">
          <InsuranceSection
            accountId={accountId}
            isPer={account?.envelope_type === 'per'}
            readOnly={readOnly}
          />
        </div>
      )}

      {/* Section prêt */}
      {isLoan && account && (
        <div className="px-1">
          <LoanSection
            account={account}
            onClose={() => setLoanCloseOpen(true)}
            readOnly={readOnly}
          />
        </div>
      )}

      {/* Transaction list — masquée pour les comptes AV/PER */}
      {!isInsurance && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
              Transactions
            </p>
            {isClosed && (
              <button
                onClick={() => setTemporarilyUnlocked((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
                title={
                  temporarilyUnlocked ? 'Repasser en lecture seule' : 'Modifier temporairement'
                }
              >
                <span
                  className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors ${temporarilyUnlocked ? 'bg-amber-400 border-amber-400' : 'bg-stone-200 border-stone-200'}`}
                >
                  <span
                    className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${temporarilyUnlocked ? 'translate-x-3' : 'translate-x-0.5'}`}
                  />
                </span>
                {temporarilyUnlocked ? 'Modification temporaire' : 'Lecture seule'}
              </button>
            )}
          </div>
          <TransactionsList
            key={account?.id}
            account={account}
            logoMap={logoMap}
            emptyMessage="Aucune transaction sur ce compte"
            readOnly={readOnly}
          />
        </>
      )}

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
