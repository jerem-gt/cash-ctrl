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
  `flex items-center gap-3 px-6 py-3 text-sm border-l-2 transition-all duration-100 ${
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
  const [menuOpen, setMenuOpen] = useState(false);
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
    for (const acc of accounts.filter((a) => !a.closed_at)) {
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
    <aside className="fixed inset-y-0 left-0 w-72 bg-sidebar-bg text-sidebar-fg flex flex-col z-50">
      {/* Logo */}
      <NavLink to="/" className="block px-6 py-6 hover:bg-white/5 transition-colors group">
        <h1 className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
          {APP_CONFIG.name} {isDev && <span className="opacity-50 font-light">(dev)</span>}
        </h1>
        <p className="text-xs uppercase tracking-[0.2em] text-white/30 mt-1">Suivi Personnel</p>
      </NavLink>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden flex flex-col">
        <div className="flex-1">
          <NavLink
            to="/transactions"
            className="flex items-center px-6 py-2 text-xs uppercase tracking-[0.2em] text-white/30 hover:text-white/60 transition-colors font-semibold"
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
              <div className="flex flex-1 items-center bg-white/6 rounded-md p-0.5 text-xs">
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
                      <div className="flex items-center justify-between pl-6 pr-3 pt-2 pb-0.5 select-none">
                        <span className="text-sm font-semibold text-white/50">{group.label}</span>
                        <span className="flex items-center gap-1">
                          <span
                            className={`text-sm font-bold tabular-nums ${group.accounts.reduce((s, a) => s + a.balance, 0) < 0 ? 'text-red-400/60' : 'text-white/45'}`}
                          >
                            {fmt(group.accounts.reduce((s, a) => s + a.balance, 0))}
                          </span>
                          <button
                            onClick={() => toggleGroup(group.label)}
                            aria-label={isCollapsed ? 'Réduire' : 'Développer'}
                            className="px-1.5 py-2.5 text-xs text-white/25 hover:text-white/60 transition-colors"
                          >
                            {isCollapsed ? '▾' : '▸'}
                          </button>
                        </span>
                      </div>
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
                                    className="w-4 h-4 object-contain rounded shrink-0 opacity-60"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                  />
                                ) : (
                                  acc.bank && (
                                    <span className="w-4 h-4 rounded bg-white/10 shrink-0 inline-block" />
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
      </nav>

      {/* User */}
      <div className="relative mt-auto border-t border-white/[0.07]">
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-full left-0 right-0 z-20 bg-sidebar-bg border-t border-white/[0.07] py-1">
              {NAV_BOTTOM.map(({ to, label, icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={navClass}
                  onClick={() => setMenuOpen(false)}
                  onMouseEnter={() => prefetchForRoute(qc, to)}
                >
                  <span className="text-base w-5 text-center opacity-80">{icon}</span>
                  {label}
                </NavLink>
              ))}
            </div>
          </>
        )}

        <div className="p-4 flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-white/70 truncate">{username}</span>
            <span className="text-xs text-white/30">Session active</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={`p-2 transition-colors rounded-md hover:bg-white/5 ${menuOpen ? 'text-white/70' : 'text-white/30 hover:text-white/70'}`}
              title="Menu"
            >
              <span className="text-lg">⚙</span>
            </button>
            <button
              onClick={() => logout.mutate()}
              className="p-2 text-white/30 hover:text-red-400/80 transition-colors rounded-md hover:bg-white/5"
              title="Déconnexion"
            >
              <span className="text-lg">⏻</span>
            </button>
          </div>
        </div>
      </div>
      <VersionStatus />
    </aside>
  );
}
