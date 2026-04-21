import { NavLink } from 'react-router-dom';
import { useLogout } from '@/hooks/useAuth';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useBanks } from '@/hooks/useBanks';
import { fmt } from '@/lib/format';
import { computeBalance } from '@/lib/account';

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

export function Sidebar({ username }: Readonly<Props>) {
  const logout = useLogout();
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const { data: banks = [] } = useBanks();

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
          {accounts.slice(0, 4).map(acc => {
            const logo = acc.bank ? (banks.find(b => b.name === acc.bank)?.logo ?? null) : null;
            return (
              <div key={acc.id} className="flex justify-between items-center py-1 gap-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  {logo && <img src={logo} alt="" className="w-3.5 h-3.5 object-contain rounded shrink-0 opacity-70" onError={e => (e.currentTarget.style.display = 'none')} />}
                  <span className="text-xs text-white/45 truncate">{acc.name}</span>
                  {acc.bank && <span className="text-[10px] text-white/25 shrink-0">({acc.bank})</span>}
                </span>
                <span className="text-xs text-white/80 font-medium tabular-nums shrink-0">
                  {fmt(computeBalance(acc, transactions))}
                </span>
              </div>
            );
          })}
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
