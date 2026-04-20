import { NavLink } from 'react-router-dom';
import { useLogout } from '@/hooks/useAuth';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { fmt } from '@/lib/format';
import type { Account, Transaction } from '@/types';

function computeBalance(account: Account, transactions: Transaction[]): number {
  return transactions
    .filter(t => t.account_id === account.id)
    .reduce((sum, t) => t.type === 'income' ? sum + t.amount : sum - t.amount, account.initial_balance);
}

const NAV_ITEMS = [
  { to: '/',             label: 'Tableau de bord', icon: '◈' },
  { to: '/transactions', label: 'Transactions',    icon: '↕' },
  { to: '/accounts',     label: 'Comptes',         icon: '▣' },
  { to: '/export',       label: 'Export',          icon: '⬡' },
  { to: '/settings',     label: 'Paramètres',      icon: '⚙' },
];

interface Props {
  username: string;
}

export function Sidebar({ username }: Props) {
  const logout = useLogout();
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-[#141210] text-[#F4F1EB] flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-7 border-b border-white/[0.07]">
        <h1 className="font-serif text-xl tracking-tight">CashCtrl</h1>
        <p className="text-[10px] text-white/30 mt-1 uppercase tracking-widest">Suivi personnel</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }: { isActive: boolean }) =>
              `flex items-center gap-3 px-6 py-2.5 text-sm border-l-2 transition-all duration-100 ${
                isActive
                  ? 'text-[#F4F1EB] border-[#8BBF5A] bg-white/6 font-medium'
                  : 'text-white/40 border-transparent hover:text-white/75 hover:bg-white/4'
              }`
            }
          >
            <span className="text-[15px] w-4 text-center opacity-80">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Balances */}
      {accounts.length > 0 && (
        <div className="px-6 py-4 border-t border-white/[0.07]">
          <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2.5">Comptes</p>
          {accounts.slice(0, 4).map(acc => (
            <div key={acc.id} className="flex justify-between py-1">
              <span className="text-xs text-white/45 truncate max-w-25">{acc.name}</span>
              <span className="text-xs text-white/80 font-medium tabular-nums">
                {fmt(computeBalance(acc, transactions))}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* User */}
      <div className="px-6 py-4 border-t border-white/[0.07] flex justify-between items-center">
        <span className="text-xs text-white/35">{username}</span>
        <button
          onClick={() => logout.mutate()}
          className="text-[11px] text-white/30 hover:text-white/60 underline transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
