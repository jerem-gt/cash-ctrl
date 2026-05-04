import { accountSeniority } from '@/lib/account.ts';
import { fmtDec } from '@/lib/format.ts';
import { Account } from '@/types.ts';

interface AccountHeaderProps {
  account: Account;
  logoMap: Record<string, string | null>;
  isInvestment: boolean;
  isLoan: boolean;
  capitalRestantDu: number;
}

const LoanHeader = ({ value }: { value: number }) => (
  <div className="flex flex-col items-start md:items-end bg-stone-100/40 p-4 rounded-2xl border border-stone-200/60 min-w-50">
    <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-stone-400 mb-1">
      Capital restant dû
    </span>
    <p className="font-serif text-4xl leading-none text-red-700">{fmtDec(value)}</p>
  </div>
);

const InvestmentHeader = ({ account }: { account: Account }) => (
  <div className="flex flex-col md:flex-row items-stretch bg-stone-100/40 p-6 rounded-2xl border border-stone-200/60 gap-5">
    <StatItem label="Cash disponible" value={account.balance} valueAll={account.balance_all} />
    <div className="hidden md:block self-stretch w-px bg-stone-200/60" />
    <StatItem label="Portefeuille" value={account.balance_stocks} />
    <div className="hidden md:block self-stretch w-px bg-stone-200/60" />
    <StatItem label="Total" value={account.balance + account.balance_stocks} isMain />
  </div>
);

const StatItem = ({
  label,
  value,
  valueAll,
  isMain = false,
}: {
  label: string;
  value: number;
  valueAll?: number;
  isMain?: boolean;
}) => (
  <div className="flex-1 flex flex-col justify-between">
    <span className="block text-[10px] uppercase tracking-[0.15em] font-bold text-stone-400 mb-4 whitespace-nowrap">
      {label}
    </span>
    <p
      className={`font-serif ${isMain ? 'text-4xl text-stone-900' : 'text-2xl text-stone-700'} leading-none ${value < 0 ? 'text-red-700' : ''}`}
    >
      {fmtDec(value)}
    </p>
    {valueAll !== undefined && valueAll !== value ? (
      <p className="text-[11px] text-stone-400 mt-1.5">
        <span>Prévisionnel&nbsp;</span>
        <span className={valueAll < 0 ? 'text-red-400' : 'text-stone-500'}>{fmtDec(valueAll)}</span>
      </p>
    ) : (
      <p className="text-[11px] mt-1.5 opacity-0 select-none" aria-hidden="true">
        <span>Alignement</span>
      </p>
    )}
  </div>
);

const DefaultHeader = ({ value, valueAll }: { value: number; valueAll?: number }) => (
  <div className="flex flex-col items-start md:items-end bg-stone-100/40 p-4 rounded-2xl border border-stone-200/60 min-w-50">
    <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-stone-400 mb-1">
      Solde disponible
    </span>
    <p
      className={`font-serif text-4xl leading-none ${value < 0 ? 'text-red-700' : 'text-stone-900'}`}
    >
      {fmtDec(value ?? 0)}
    </p>
    {valueAll !== undefined && valueAll !== value && (
      <p className="text-[11px] text-stone-400 mt-1.5">
        <span>Prévisionnel&nbsp;</span>
        <span className={valueAll < 0 ? 'text-red-400' : 'text-stone-500'}>{fmtDec(valueAll)}</span>
      </p>
    )}
  </div>
);

export function AccountHeader({
  account,
  logoMap,
  isInvestment,
  isLoan,
  capitalRestantDu,
}: Readonly<AccountHeaderProps>) {
  return (
    <div>
      <div className="p-8 bg-[#fafaf9] border-b border-stone-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
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
                {account.name ?? 'Compte'}
              </h2>

              {account.opening_date && (
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
          {isLoan && <LoanHeader value={capitalRestantDu} />}
          {isInvestment && <InvestmentHeader account={account} />}
          {!isLoan && !isInvestment && (
            <DefaultHeader value={account.balance} valueAll={account.balance_all} />
          )}
        </div>
      </div>
    </div>
  );
}
