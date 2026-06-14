import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { accountSeniority } from '@/lib/account.ts';
import { currentLocale, fmtDec } from '@/lib/format.ts';
import { Account } from '@/types.ts';

interface AccountHeaderProps {
  account: Account;
  logoMap: Record<string, string | null>;
  bankLoginUrl: string | null;
  isInvestment: boolean;
  isInsurance: boolean;
  isLoan: boolean;
  capitalRestantDu: number;
}

const LoanHeader = ({ value }: { value: number }) => {
  const { t } = useTranslation('accounts');
  return (
    <div className="flex w-full md:w-auto bg-canvas p-6 rounded-2xl border border-line-subtle md:min-w-50">
      <StatItem label={t('header.loan_due')} value={value} isMain forceRed />
    </div>
  );
};

const InvestmentHeader = ({ account }: { account: Account }) => {
  const { t } = useTranslation('accounts');
  return (
    <div className="flex flex-col md:flex-row items-stretch w-full md:w-auto bg-canvas p-6 rounded-2xl border border-line-subtle gap-4 md:gap-5">
      <StatItem label={t('header.cash')} value={account.balance} valueAll={account.balance_all} />
      <div className="hidden md:block self-stretch w-px bg-surface-emphasis" />
      <StatItem label={t('header.portfolio')} value={account.balance_stocks} />
      <div className="hidden md:block self-stretch w-px bg-surface-emphasis" />
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
      <span className="block text-[10px] uppercase tracking-[0.15em] font-bold text-content-subtle mb-4 whitespace-nowrap">
        {label}
      </span>
      <p
        className={`font-display ${isMain ? 'text-4xl text-content' : 'text-2xl text-content-secondary'} leading-none ${forceRed || value < 0 ? 'text-danger' : ''}`}
      >
        {fmtDec(value)}
      </p>
      {valueAll !== undefined && valueAll !== value ? (
        <p className="text-[11px] text-content-subtle mt-1.5">
          <span>{t('header.forecasted')}&nbsp;</span>
          <span className={valueAll < 0 ? 'text-danger' : 'text-content-muted'}>
            {fmtDec(valueAll)}
          </span>
        </p>
      ) : (
        <p className="text-[11px] mt-1.5 invisible" aria-hidden="true">
          &nbsp;
        </p>
      )}
    </div>
  );
};

const InsuranceHeader = ({ account }: { account: Account }) => {
  const { t } = useTranslation('accounts');
  return (
    <div className="flex w-full md:w-auto bg-canvas p-6 rounded-2xl border border-line-subtle md:min-w-50">
      <StatItem label={t('header.insurance')} value={account.balance_insurance} isMain />
    </div>
  );
};

const DefaultHeader = ({ value, valueAll }: { value: number; valueAll?: number }) => {
  const { t } = useTranslation('accounts');
  return (
    <div className="flex w-full md:w-auto bg-canvas p-6 rounded-2xl border border-line-subtle md:min-w-50">
      <StatItem label={t('header.balance')} value={value} valueAll={valueAll} isMain />
    </div>
  );
};

export function AccountHeader({
  account,
  logoMap,
  bankLoginUrl,
  isInvestment,
  isInsurance,
  isLoan,
  capitalRestantDu,
}: Readonly<AccountHeaderProps>) {
  const { t } = useTranslation('accounts');
  return (
    <div>
      <div className="p-4 md:p-8 bg-surface rounded-2xl border border-line-subtle shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8">
          <div className="flex gap-5 items-start">
            {/* Conteneur Logo */}
            {account.bank && logoMap[account.bank] && (
              <div className="shrink-0 w-14 h-14 bg-surface rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0,04)] border border-line flex items-center justify-center p-2.5">
                <img
                  src={logoMap[account.bank] ?? undefined}
                  alt={`Logo ${account.bank}`}
                  className="w-full h-full object-contain"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-content-muted font-medium text-xs tracking-wide">
                {bankLoginUrl ? (
                  <a
                    href={bankLoginUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 uppercase hover:text-brand-500 transition-colors"
                  >
                    {account.bank}
                    <ExternalLink size={11} />
                  </a>
                ) : (
                  <span className="uppercase">{account.bank}</span>
                )}
                <span className="text-content-faint">•</span>
                <span>{account.type}</span>
                {isInvestment && (
                  <>
                    <span className="text-content-faint">•</span>
                    <span className="bg-info-surface text-info border border-info/30 text-[10px] rounded px-1.5 py-0.5 font-medium">
                      {t('header.investment_badge')}
                    </span>
                  </>
                )}
                {isLoan && (
                  <>
                    <span className="text-content-faint">•</span>
                    <span className="bg-warning-surface text-warning border border-warning/30 text-[10px] rounded px-1.5 py-0.5 font-medium">
                      {t('header.loan_badge')}
                    </span>
                  </>
                )}
                {account.closed_at && (
                  <>
                    <span className="text-content-faint">•</span>
                    <span className="bg-surface-emphasis text-content-muted border border-line text-[10px] rounded px-1.5 py-0.5 font-medium">
                      {t('header.closed_badge')}
                    </span>
                  </>
                )}
              </div>

              <h2 className="font-display text-4xl text-content tracking-tight">
                {account.name ?? 'Compte'}
              </h2>

              {account.opening_date && (
                <p className="text-sm text-content-muted font-medium">
                  <span className="text-content-subtle">{t('header.opened_on')}</span>{' '}
                  {new Date(account.opening_date + 'T00:00:00').toLocaleDateString(
                    currentLocale(),
                    {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    },
                  )}
                  <span className="mx-2 text-content-faint">—</span>
                  <span className="bg-surface-strong/50 text-content-secondary px-2 py-0.5 rounded text-[11px] uppercase tracking-wider">
                    {accountSeniority(account.opening_date, t)}
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
