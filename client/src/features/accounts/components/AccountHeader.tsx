import { useTranslation } from 'react-i18next';

import { accountSeniority } from '@/lib/account.ts';
import { fmtDec } from '@/lib/format.ts';
import { Account } from '@/types.ts';

interface AccountHeaderProps {
  account: Account;
  logoMap: Record<string, string | null>;
  isInvestment: boolean;
  isInsurance: boolean;
  isLoan: boolean;
  capitalRestantDu: number;
}

const LoanHeader = ({ value }: { value: number }) => {
  const { t } = useTranslation('accounts');
  return (
    <div className="flex w-full md:w-auto bg-stone-100/40 p-6 rounded-2xl border border-stone-200/60 md:min-w-50">
      <StatItem label={t('header.loan_due')} value={value} isMain forceRed />
    </div>
  );
};

const InvestmentHeader = ({ account }: { account: Account }) => {
  const { t } = useTranslation('accounts');
  return (
    <div className="flex flex-col md:flex-row items-stretch w-full md:w-auto bg-stone-100/40 p-6 rounded-2xl border border-stone-200/60 gap-4 md:gap-5">
      <StatItem label={t('header.cash')} value={account.balance} valueAll={account.balance_all} />
      <div className="hidden md:block self-stretch w-px bg-stone-200/60" />
      <StatItem label={t('header.portfolio')} value={account.balance_stocks} />
      <div className="hidden md:block self-stretch w-px bg-stone-200/60" />
      <StatItem label={t('header.total')} value={account.balance + account.balance_stocks} isMain />
    </div>
  );
};

const StatItem = ({
  label,
  value,
  valueAll,
  isMain = false,
  forceRed = false,
}: {
  label: string;
  value: number;
  valueAll?: number;
  isMain?: boolean;
  forceRed?: boolean;
}) => {
  const { t } = useTranslation('accounts');
  return (
    <div className="flex-1 flex flex-col justify-between">
      <span className="block text-[10px] uppercase tracking-[0.15em] font-bold text-stone-400 mb-4 whitespace-nowrap">
        {label}
      </span>
      <p
        className={`font-sans ${isMain ? 'text-4xl text-stone-900' : 'text-2xl text-stone-700'} leading-none ${forceRed || value < 0 ? 'text-red-700' : ''}`}
      >
        {fmtDec(value)}
      </p>
      {valueAll !== undefined && valueAll !== value ? (
        <p className="text-[11px] text-stone-400 mt-1.5">
          <span>{t('header.forecasted')}&nbsp;</span>
          <span className={valueAll < 0 ? 'text-red-400' : 'text-stone-500'}>
            {fmtDec(valueAll)}
          </span>
        </p>
      ) : (
        <p className="text-[11px] mt-1.5 opacity-0 select-none" aria-hidden="true">
          <span>Alignement</span>
        </p>
      )}
    </div>
  );
};

const InsuranceHeader = ({ account }: { account: Account }) => {
  const { t } = useTranslation('accounts');
  return (
    <div className="flex w-full md:w-auto bg-stone-100/40 p-6 rounded-2xl border border-stone-200/60 md:min-w-50">
      <StatItem label={t('header.insurance')} value={account.balance_insurance} isMain />
    </div>
  );
};

const DefaultHeader = ({ value, valueAll }: { value: number; valueAll?: number }) => {
  const { t } = useTranslation('accounts');
  return (
    <div className="flex w-full md:w-auto bg-stone-100/40 p-6 rounded-2xl border border-stone-200/60 md:min-w-50">
      <StatItem label={t('header.balance')} value={value} valueAll={valueAll} isMain />
    </div>
  );
};

export function AccountHeader({
  account,
  logoMap,
  isInvestment,
  isInsurance,
  isLoan,
  capitalRestantDu,
}: Readonly<AccountHeaderProps>) {
  const { t } = useTranslation('accounts');
  return (
    <div>
      <div className="p-4 md:p-8 bg-[#fafaf9] border-b border-stone-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8">
          <div className="flex gap-5 items-start">
            {/* Conteneur Logo */}
            {account.bank && logoMap[account.bank] && (
              <div className="shrink-0 w-14 h-14 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0,04)] border border-stone-200 flex items-center justify-center p-2.5">
                <img
                  src={logoMap[account.bank] ?? undefined}
                  alt={`Logo ${account.bank}`}
                  className="w-full h-full object-contain"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-stone-500 font-medium text-xs tracking-wide">
                <span className="uppercase">{account.bank}</span>
                <span className="text-stone-300">•</span>
                <span>{account.type}</span>
                {isInvestment && (
                  <>
                    <span className="text-stone-300">•</span>
                    <span className="bg-indigo-50 text-indigo-500 border border-indigo-200 text-[10px] rounded px-1.5 py-0.5 font-medium">
                      {t('header.investment_badge')}
                    </span>
                  </>
                )}
                {isLoan && (
                  <>
                    <span className="text-stone-300">•</span>
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] rounded px-1.5 py-0.5 font-medium">
                      {t('header.loan_badge')}
                    </span>
                  </>
                )}
                {account.closed_at && (
                  <>
                    <span className="text-stone-300">•</span>
                    <span className="bg-stone-100 text-stone-500 border border-stone-200 text-[10px] rounded px-1.5 py-0.5 font-medium">
                      {t('header.closed_badge')}
                    </span>
                  </>
                )}
              </div>

              <h2 className="font-sans text-4xl text-stone-900 tracking-tight">
                {account.name ?? 'Compte'}
              </h2>

              {account.opening_date && (
                <p className="text-sm text-stone-500 font-medium">
                  <span className="text-stone-400">{t('header.opened_on')}</span>{' '}
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
          {isLoan && <LoanHeader value={capitalRestantDu} />}
          {isInvestment && <InvestmentHeader account={account} />}
          {isInsurance && <InsuranceHeader account={account} />}
          {!isLoan && !isInvestment && !isInsurance && (
            <DefaultHeader value={account.balance} valueAll={account.balance_all} />
          )}
        </div>
      </div>
    </div>
  );
}
