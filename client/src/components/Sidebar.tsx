import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useMatch } from 'react-router-dom';

import { Tabs } from '@/components/ui';
import { VersionStatus } from '@/components/VersionStatus.tsx';
import { APP_CONFIG } from '@/constants.ts';
import { useAccounts } from '@/hooks/useAccounts';
import { setGroupBy, useAccountsGroupBy } from '@/hooks/useAccountsGroupBy';
import { useAppVersion } from '@/hooks/useAppVersion.ts';
import { useLogout } from '@/hooks/useAuth';
import { useBanks } from '@/hooks/useBanks';
import { useLogoMap } from '@/hooks/useLogoMap';
import { accountDisplayBalance } from '@/lib/account';
import { fmt } from '@/lib/format';
import { prefetchAccountDetail, prefetchForRoute } from '@/lib/prefetch';
import type { Account } from '@/types';

const NAV_BOTTOM = [
  { to: '/transactions', label: 'Toutes les transactions', icon: '▣', end: true },
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
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ username, mobileOpen, onMobileClose }: Readonly<Props>) {
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

  const { pathname } = useLocation();
  useEffect(() => {
    onMobileClose();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const accountsActive = useMatch({ path: '/accounts/:id', end: true }) !== null;
  const logoMap = useLogoMap();
  const bankSortOrder = useMemo(
    () => Object.fromEntries(banks.map((b) => [b.name, b.sort_order])),
    [banks],
  );

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
          return (bankSortOrder[a] ?? Infinity) - (bankSortOrder[b] ?? Infinity);
        }
        return a.localeCompare(b);
      })
      .map(([key, accs]) => ({
        label: groupBy === 'bank' && key === '' ? 'Sans banque' : key,
        accounts: accs,
      }));
  }, [accounts, groupBy, bankSortOrder]);
  const soldeTotal = useMemo(
    () =>
      groups.reduce((t, g) => t + g.accounts.reduce((s, a) => s + accountDisplayBalance(a), 0), 0),
    [groups],
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 w-72 bg-sidebar-bg text-sidebar-fg flex flex-col z-50 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <button
          onClick={onMobileClose}
          className="absolute top-4 right-4 p-1.5 text-white/30 hover:text-white/70 transition-colors rounded-md hover:bg-white/5 md:hidden"
          aria-label="Fermer le menu"
        >
          <X className="h-5 w-5" />
        </button>
        {/* Logo */}
        <NavLink to="/" className="block px-6 py-6 hover:bg-white/5 transition-colors group">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
            <img src="/favicon.svg" alt="logo cash-ctrl" className="h-[2em] w-auto" />
            {APP_CONFIG.name} {isDev && <span className="opacity-50 font-light">(dev)</span>}
          </h1>
          <p className="text-xs uppercase tracking-[0.2em] text-white/30 mt-1">Suivi Personnel</p>
        </NavLink>

        {/* Solde */}
        <div className="flex flex-col items-center py-6 border border-white/5">
          <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-1">
            Patrimoine Net
          </span>
          <span className="text-4xl font-bold text-white tracking-tight">{fmt(soldeTotal)}</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 flex flex-col overflow-hidden">
          <div className="flex flex-col flex-1 overflow-hidden">
            <NavLink
              to="/accounts"
              className="flex items-center justify-between px-6 py-2 text-xs uppercase tracking-[0.2em] text-white/30 hover:text-white/60 transition-colors font-semibold"
            >
              <span>Comptes</span>
            </NavLink>
            {/* Comptes */}
            <div
              className={`flex flex-col flex-1 overflow-hidden border-l-2 transition-colors duration-100 ${accountsActive ? 'border-sidebar-accent' : 'border-transparent'}`}
            >
              <div
                className={`flex items-center px-4 py-2 shrink-0 transition-colors duration-100 ${
                  accountsActive ? 'bg-white/6' : ''
                }`}
              >
                <Tabs
                  variant="dark"
                  tabs={[
                    { key: 'bank', label: 'Banque' },
                    { key: 'type', label: 'Type' },
                  ]}
                  active={groupBy}
                  onChange={(key) => setGroupBy(key as 'bank' | 'type')}
                  className="flex-1"
                />
              </div>

              {accounts.length > 0 && (
                <div className="flex-1 overflow-y-auto overflow-x-hidden pb-1">
                  {groups.map((group) => {
                    const isCollapsed = collapsedGroups.has(group.label);
                    return (
                      <div key={group.label}>
                        <div className="flex items-center justify-between pl-6 pr-3 pt-2 pb-0.5 select-none">
                          <span className="text-sm font-semibold text-white/50">{group.label}</span>
                          <span className="flex items-center gap-1">
                            <span
                              className={`text-sm font-bold tabular-nums ${group.accounts.reduce((s, a) => s + accountDisplayBalance(a), 0) < 0 ? 'text-red-400/60' : 'text-white/45'}`}
                            >
                              {fmt(
                                group.accounts.reduce((s, a) => s + accountDisplayBalance(a), 0),
                              )}
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
                                  className={`tabular-nums shrink-0 ${accountDisplayBalance(acc) < 0 ? 'text-red-400/70' : ''}`}
                                >
                                  {fmt(accountDisplayBalance(acc))}
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
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
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
    </>
  );
}
