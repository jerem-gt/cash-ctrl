import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { NavLink, useMatch } from 'react-router-dom';

import { UserMenu } from '@/components/UserMenu.tsx';
import { useAccounts } from '@/hooks/useAccounts';
import { useLogout } from '@/hooks/useAuth';
import { useBanks } from '@/hooks/useBanks';
import { appName } from '@/lib/appname.ts';
import { fmt } from '@/lib/format';
import { prefetchAccountDetail, prefetchForRoute } from '@/lib/prefetch';
import type { Account } from '@/types';

type GroupBy = 'bank' | 'type';

const NAV_MAIN = [
  { to: '/', label: 'Tableau de bord', icon: '◈' },
  { to: '/transactions', label: 'Transactions', icon: '↕' },
  { to: '/scheduled', label: 'Planifiées', icon: '↻' },
];

const NAV_BOTTOM = [
  { to: '/export', label: 'Export', icon: '⬡' },
  { to: '/settings', label: 'Paramètres', icon: '⚙' },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-6 py-2.5 text-sm border-l-2 transition-all duration-100 ${
    isActive
      ? 'text-sidebar-fg border-sidebar-accent bg-white/6 font-medium'
      : 'text-white/40 border-transparent hover:text-white/75 hover:bg-white/4'
  }`;

interface Props {
  username: string;
}

export function Sidebar({ username }: Readonly<Props>) {
  const qc = useQueryClient();
  const logout = useLogout();
  const { data: accounts = [] } = useAccounts();
  const { data: banks = [] } = useBanks();

  const [expanded, setExpanded] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>(
    () => (localStorage.getItem('cashctrl.accountsGroupBy') as GroupBy) ?? 'bank',
  );

  const accountsActive = useMatch({ path: '/accounts', end: false }) !== null;
  const logoMap = useMemo(() => Object.fromEntries(banks.map((b) => [b.name, b.logo])), [banks]);

  const groups = useMemo(() => {
    const map = new Map<string, Account[]>();
    for (const acc of accounts) {
      const key = groupBy === 'bank' ? (acc.bank ?? '') : (acc.type ?? 'Autre');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(acc);
    }
    return [...map.entries()]
      .sort(([a], [b]) => {
        if (groupBy === 'bank') {
          if (a === '') return 1;
          if (b === '') return -1;
        }
        return a.localeCompare(b);
      })
      .map(([key, accs]) => ({
        label: groupBy === 'bank' && key === '' ? 'Sans banque' : key,
        accounts: accs,
      }));
  }, [accounts, groupBy]);

  const handleSetGroupBy = (g: GroupBy) => {
    setGroupBy(g);
    localStorage.setItem('cashctrl.accountsGroupBy', g);
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-sidebar-bg text-sidebar-fg flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-7 border-b border-white/[0.07]">
        <h1 className="font-serif text-xl tracking-tight">{appName()}</h1>
        <p className="text-[10px] text-white/30 mt-1 uppercase tracking-widest">Suivi personnel</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden flex flex-col">
        <div className="flex-1">
          {NAV_MAIN.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={navClass}
              onMouseEnter={() => prefetchForRoute(qc, to)}
            >
              <span className="text-[15px] w-4 text-center opacity-80">{icon}</span>
              {label}
            </NavLink>
          ))}

          {/* Comptes — expandable */}
          <div
            className={`border-l-2 transition-colors duration-100 ${accountsActive ? 'border-sidebar-accent' : 'border-transparent'}`}
          >
            <div
              className={`flex items-center transition-colors duration-100 ${accountsActive ? 'bg-white/6' : ''}`}
            >
              <NavLink
                to="/accounts"
                end
                onMouseEnter={() => prefetchForRoute(qc, '/accounts')}
                className={({ isActive }: { isActive: boolean }) =>
                  `flex items-center gap-3 pl-6 py-2.5 text-sm flex-1 transition-all duration-100 ${
                    isActive ? 'text-sidebar-fg font-medium' : 'text-white/40 hover:text-white/75'
                  }`
                }
              >
                <span className="text-[15px] w-4 text-center opacity-80">▣</span>
                <span>Comptes</span>
              </NavLink>

              {expanded && (
                <div className="flex items-center bg-white/[0.06] rounded-md p-0.5 text-[10px]">
                  <button
                    onClick={() => handleSetGroupBy('bank')}
                    className={`px-1.5 py-0.5 rounded transition-all ${groupBy === 'bank' ? 'bg-white/15 text-white/80' : 'text-white/30 hover:text-white/55'}`}
                  >
                    Banque
                  </button>
                  <button
                    onClick={() => handleSetGroupBy('type')}
                    className={`px-1.5 py-0.5 rounded transition-all ${groupBy === 'type' ? 'bg-white/15 text-white/80' : 'text-white/30 hover:text-white/55'}`}
                  >
                    Type
                  </button>
                </div>
              )}

              <button
                onClick={() => setExpanded((e) => !e)}
                aria-label={expanded ? 'Réduire' : 'Développer'}
                className="px-3 py-2.5 text-[10px] text-white/25 hover:text-white/60 transition-colors"
              >
                {expanded ? '▾' : '▸'}
              </button>
            </div>

            {expanded && accounts.length > 0 && (
              <div className="pb-1">
                {groups.map((group) => (
                  <div key={group.label}>
                    <p className="px-6 pt-2 pb-0.5 text-[9px] font-medium uppercase tracking-widest text-white/20 select-none">
                      {group.label}
                    </p>
                    {group.accounts.map((acc) => {
                      const logo = acc.bank ? (logoMap[acc.bank] ?? null) : null;
                      return (
                        <NavLink
                          key={acc.id}
                          to={`/accounts/${acc.id}`}
                          onMouseEnter={() => prefetchAccountDetail(qc, acc.id)}
                          className={({ isActive }: { isActive: boolean }) =>
                            `flex items-center justify-between pl-6 pr-3 py-1.5 gap-2 text-xs transition-all duration-100 ${
                              isActive
                                ? 'bg-white/8 text-white/90'
                                : 'text-white/40 hover:text-white/70 hover:bg-white/4'
                            }`
                          }
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            {logo ? (
                              <img
                                src={logo}
                                alt=""
                                className="w-3.5 h-3.5 object-contain rounded shrink-0 opacity-60"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            ) : (
                              acc.bank && (
                                <span className="w-3.5 h-3.5 rounded bg-white/10 shrink-0 inline-block" />
                              )
                            )}
                            <span className="truncate">{acc.name}</span>
                          </span>
                          <span
                            className={`tabular-nums shrink-0 ${acc.balance < 0 ? 'text-red-400/70' : ''}`}
                          >
                            {fmt(acc.balance)}
                          </span>
                        </NavLink>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/[0.07] pt-2 mt-2">
          {NAV_BOTTOM.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={navClass}
              onMouseEnter={() => prefetchForRoute(qc, to)}
            >
              <span className="text-[15px] w-4 text-center opacity-80">{icon}</span>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User */}
      <UserMenu username={username} onLogout={() => logout.mutate()} />
    </aside>
  );
}
