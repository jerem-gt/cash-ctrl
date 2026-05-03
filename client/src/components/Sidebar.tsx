import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { NavLink, useMatch } from 'react-router-dom';

import { VersionStatus } from '@/components/VersionStatus.tsx';
import { APP_CONFIG } from '@/constants.ts';
import { useAccounts } from '@/hooks/useAccounts';
import { setGroupBy, useAccountsGroupBy } from '@/hooks/useAccountsGroupBy';
import { useAppVersion } from '@/hooks/useAppVersion.ts';
import { useLogout } from '@/hooks/useAuth';
import { useBanks } from '@/hooks/useBanks';
import { fmt } from '@/lib/format';
import { prefetchAccountDetail, prefetchForRoute } from '@/lib/prefetch';
import type { Account } from '@/types';

const NAV_BOTTOM = [
  { to: '/accounts', label: 'Gestion des comptes', icon: '▣', end: true },
  { to: '/scheduled', label: 'Planifications', icon: '🗓' },
  { to: '/settings', label: 'Configuration', icon: '⚙' },
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
  const { isDev } = useAppVersion();

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };
  const groupBy = useAccountsGroupBy();

  const accountsActive = useMatch({ path: '/accounts/:id', end: true }) !== null;
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

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-sidebar-bg text-sidebar-fg flex flex-col z-50">
      {/* Logo */}
      <NavLink to="/" className="block px-6 py-5 hover:bg-white/5 transition-colors group">
        <h1 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
          {APP_CONFIG.name} {isDev && <span className="opacity-50 font-light">(dev)</span>}
        </h1>
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mt-1">Suivi Personnel</p>
      </NavLink>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden flex flex-col">
        <div className="flex-1">
          <NavLink
            to="/transactions"
            className="flex items-center px-6 py-2 text-[10px] uppercase tracking-[0.2em] text-white/30 hover:text-white/60 transition-colors font-semibold"
          >
            Comptes
          </NavLink>
          {/* Comptes */}
          <div
            className={`border-l-2 transition-colors duration-100 ${accountsActive ? 'border-sidebar-accent' : 'border-transparent'}`}
          >
            <div
              className={`flex items-center px-4 py-2 transition-colors duration-100 ${
                accountsActive ? 'bg-white/6' : ''
              }`}
            >
              <div className="flex flex-1 items-center bg-white/6 rounded-md p-0.5 text-[10px]">
                <button
                  onClick={() => setGroupBy('bank')}
                  className={`flex-1 px-1.5 py-1 rounded transition-all ${
                    groupBy === 'bank'
                      ? 'bg-white/15 text-white/80 shadow-sm'
                      : 'text-white/30 hover:text-white/55'
                  }`}
                >
                  Banque
                </button>
                <button
                  onClick={() => setGroupBy('type')}
                  className={`flex-1 px-1.5 py-1 rounded transition-all ${
                    groupBy === 'type'
                      ? 'bg-white/15 text-white/80 shadow-sm'
                      : 'text-white/30 hover:text-white/55'
                  }`}
                >
                  Type
                </button>
              </div>
            </div>

            {accounts.length > 0 && (
              <div className="pb-1">
                {groups.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.label);
                  return (
                    <div key={group.label}>
                      <p className="px-6 pt-2 pb-0.5 text-[9px] font-medium uppercase tracking-widest text-white/20 select-none">
                        {group.label}
                        <button
                          onClick={() => toggleGroup(group.label)}
                          aria-label={isCollapsed ? 'Réduire' : 'Développer'}
                          className="px-3 py-2.5 text-[10px] text-white/25 hover:text-white/60 transition-colors"
                        >
                          {isCollapsed ? '▾' : '▸'}
                        </button>
                      </p>
                      {!isCollapsed &&
                        group.accounts.map((acc) => {
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
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/[0.07] pt-2 mt-2">
          {NAV_BOTTOM.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
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
      <div className="mt-auto border-t border-white/[0.07] p-4 flex items-center justify-between">
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium text-white/70 truncate">{username}</span>
          <span className="text-[10px] text-white/30">Session active</span>
        </div>

        <button
          onClick={() => logout.mutate()}
          className="p-2 text-white/30 hover:text-red-400/80 transition-colors rounded-md hover:bg-white/5"
          title="Déconnexion"
        >
          <span className="text-lg">⏻</span>
        </button>
      </div>
      <VersionStatus />
    </aside>
  );
}
