import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AccountHeader } from '@/components/AccountHeader.tsx';
import { CloseAccountModal } from '@/components/CloseAccountModal';
import { InsuranceSection } from '@/components/InsuranceSection';
import { LoanSection } from '@/components/LoanSection';
import { PortfolioSection } from '@/components/PortfolioSection';
import { TransactionsList } from '@/components/TransactionsList';
import { useAccounts } from '@/hooks/useAccounts';
import { useBanks } from '@/hooks/useBanks';
import { useLoan, useLoanInstallments } from '@/hooks/useLoans';

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const accountId = Number.parseInt(id ?? '0');
  const navigate = useNavigate();

  const { data: accounts = [] } = useAccounts();
  const { data: banks = [] } = useBanks();
  const logoMap = useMemo(() => Object.fromEntries(banks.map((b) => [b.name, b.logo])), [banks]);

  const account = accounts.find((a) => a.id === accountId);
  const isInvestment = account?.envelope_type === 'investment';
  const isInsurance =
    account?.envelope_type === 'life_insurance' || account?.envelope_type === 'per';
  const isLoan = account?.envelope_type === 'loan';
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
        isLoan={isLoan}
        capitalRestantDu={capitalRestantDu}
      />

      {/* Portefeuille bourse */}
      {isInvestment && (
        <div className="px-1">
          <PortfolioSection accountId={accountId} />
        </div>
      )}

      {/* Enveloppe assurance */}
      {isInsurance && (
        <div className="px-1">
          <InsuranceSection accountId={accountId} />
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
