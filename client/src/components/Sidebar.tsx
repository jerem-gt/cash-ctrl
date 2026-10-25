import type { Account } from '@cashctrl/types';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart2,
  Calendar,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Power,
  Search,
  Settings,
  Star,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation, useMatch } from 'react-router';

import { Tabs } from '@/components/ui';
import { nextEscapeOrder, pushEscape } from '@/components/ui/escapeStack';
import { getFocusReturnTarget } from '@/components/ui/focusTracker';
import { VersionStatus } from '@/components/VersionStatus.tsx';
import { APP_CONFIG } from '@/constants.ts';
import { useBudgetBreaker } from '@/features/budget-breaker/store';
import { useAccounts } from '@/hooks/useAccounts';
import { setGroupBy, useAccountsGroupBy } from '@/hooks/useAccountsGroupBy';
import { useAppVersion } from '@/hooks/useAppVersion.ts';
import { useLogout } from '@/hooks/useAuth';
import { useBanks } from '@/hooks/useBanks';
import { useLogoMap } from '@/hooks/useLogoMap';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { accountDisplayBalance, favoriteAccounts } from '@/lib/account';
import { fmt } from '@/lib/format';
import { isMacPlatform } from '@/lib/platform';
import { prefetchAccountDetail, prefetchForRoute } from '@/lib/prefetch';

const NAV_BOTTOM_ITEMS = [
  { to: '/transactions', key: 'all_transactions' as const, icon: LayoutGrid, end: true },
  { to: '/scheduled', key: 'scheduled' as const, icon: Calendar },
  { to: '/reports', key: 'reports' as const, icon: BarChart2 },
  { to: '/settings', key: 'settings' as const, icon: Settings },
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
  onOpenSearch: () => void;
}

export function Sidebar({ username, mobileOpen, onMobileClose, onOpenSearch }: Readonly<Props>) {
  const { t } = useTranslation('sidebar');
  const { t: ts } = useTranslation('search');
  const qc = useQueryClient();
  const logout = useLogout();
  const { data: accounts = [] } = useAccounts();
  const { data: banks = [] } = useBanks();
  const { isDev } = useAppVersion();

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
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
  }, [pathname, onMobileClose]);

  const { active: gameActive, remainingRatio } = useBudgetBreaker();
  useEffect(() => {
    if (gameActive) onMobileClose();
  }, [gameActive, onMobileClose]);

  const isDesktop = useMediaQuery('(min-width: 768px)', true);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onMobileCloseRef = useRef(onMobileClose);
  useEffect(() => {
    onMobileCloseRef.current = onMobileClose;
  });
  useEffect(() => {
    if (!mobileOpen) return;
    const trigger = getFocusReturnTarget();
    closeButtonRef.current?.focus();
    const release = pushEscape({
      onEscape: () => onMobileCloseRef.current(),
      order: nextEscapeOrder(),
    });
    return () => {
      release();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [mobileOpen]);

  const accountsActive = useMatch({ path: '/accounts/:id', end: true }) !== null;
  const logoMap = useLogoMap();
  const bankSortOrder = useMemo(
    () => Object.fromEntries(banks.map((b) => [b.name, b.sort_order])),
    [banks],
  );

  const groups = useMemo(() => {
    const emptyKey = groupBy === 'bank' ? 'no_bank' : 'no_type';
    const map = new Map<string, Account[]>();
    for (const acc of accounts.filter((a) => !a.closed_at)) {
      const key = groupBy === 'bank' ? (acc.bank ?? '') : (acc.type ?? '');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(acc);
    }
    return [...map.entries()]
      .sort(([a], [b]) => {
        if (a === '') return 1;
        if (b === '') return -1;
        if (groupBy === 'bank') {
          return (bankSortOrder[a] ?? Infinity) - (bankSortOrder[b] ?? Infinity);
        }
        return a.localeCompare(b);
      })
      .map(([key, accs]) => ({
        label: key === '' ? t(emptyKey) : key,
        accounts: accs,
      }));
  }, [accounts, groupBy, bankSortOrder, t]);
  const renderAccountLink = (acc: Account, compact = false) => {
    const logo = acc.bank ? (logoMap[acc.bank] ?? null) : null;
    return (
      <NavLink
        key={acc.id}
        to={`/accounts/${acc.id}`}
        onMouseEnter={() => prefetchAccountDetail(qc, acc.id)}
        className={({ isActive }: { isActive: boolean }) =>
          `flex items-center justify-between pl-6 pr-3 ${compact ? 'py-1' : 'py-1.5'} gap-2 text-xs transition-all duration-100 ${
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
            acc.bank && <span className="w-4 h-4 rounded bg-white/10 shrink-0 inline-block" />
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
  };

  const favorites = useMemo(() => favoriteAccounts(accounts), [accounts]);
  const soldeTotal = useMemo(
    () =>
      groups.reduce(
        (sum, g) => sum + g.accounts.reduce((s, a) => s + accountDisplayBalance(a), 0),
        0,
      ),
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
        inert={!mobileOpen && !isDesktop}
        className={`fixed inset-y-0 left-0 w-72 bg-sidebar-bg text-sidebar-fg flex flex-col z-50 transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <button
          type="button"
          ref={closeButtonRef}
          onClick={onMobileClose}
          className="absolute top-4 right-4 p-1.5 text-white/30 hover:text-white/70 transition-colors rounded-md hover:bg-white/5 md:hidden"
          aria-label={t('close_menu')}
        >
          <X className="h-5 w-5" />
        </button>
        {/* Logo */}
        <NavLink to="/" className="block px-6 py-6 hover:bg-white/5 transition-colors group">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white group-hover:text-brand-400 transition-colors">
            <img src="/favicon.svg" alt="logo cash-ctrl" className="h-[2em] w-auto" />
            {APP_CONFIG.name} {isDev && <span className="opacity-50 font-light">(dev)</span>}
          </h1>
          <p className="text-xs uppercase tracking-[0.2em] text-white/30 mt-1">
            {t('personal_tracking')}
          </p>
        </NavLink>

        {/* Recherche */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label={ts('aria_open')}
          className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">{ts('sidebar_button')}</span>
          <kbd className="px-1.5 py-0.5 rounded border border-white/10 text-[10px] text-white/30">
            {isMacPlatform() ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>

        {/* Solde */}
        <div
          data-budget-breaker-ignore
          className="flex flex-col items-center py-6 border-y border-white/[0.07]"
        >
          <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-1">
            {t('patrimony_net')}
          </span>
          <span
            className={`font-display text-4xl font-bold tracking-tight tabular-nums transition-colors duration-500 ${
              gameActive ? 'text-red-400' : 'text-white'
            }`}
          >
            {fmt(soldeTotal * remainingRatio)}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 flex flex-col overflow-hidden">
          {favorites.length > 0 && (
            <div className="shrink-0 mb-2 pb-2 border-b border-white/[0.07]">
              <div className="flex items-center gap-1.5 px-6 py-2 text-xs uppercase tracking-[0.2em] text-white/30 font-semibold select-none">
                <Star className="h-3 w-3" />
                <span>{t('favorites_section')}</span>
              </div>
              <div className="max-h-40 overflow-y-auto overflow-x-hidden">
                {favorites.map((acc) => renderAccountLink(acc, true))}
              </div>
            </div>
          )}
          <div className="flex flex-col flex-1 overflow-hidden">
            <NavLink
              to="/accounts"
              className="flex items-center justify-between px-6 py-2 text-xs uppercase tracking-[0.2em] text-white/30 hover:text-white/60 transition-colors font-semibold"
            >
              <span>{t('accounts_section')}</span>
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
                  variant="sidebar"
                  tabs={[
                    { key: 'bank', label: t('group_bank') },
                    { key: 'type', label: t('group_type') },
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
                              type="button"
                              onClick={() => toggleGroup(group.label)}
                              aria-label={isCollapsed ? t('expand') : t('collapse')}
                              className="px-1.5 py-2.5 text-white/25 hover:text-white/60 transition-colors"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </span>
                        </div>
                        {!isCollapsed && group.accounts.map((acc) => renderAccountLink(acc))}
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
                className="fixed inset-0 z-10 bg-black/30"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="absolute bottom-full left-0 right-0 z-20 mx-3 mb-2 overflow-hidden rounded-xl bg-sidebar-elevated border border-white/10 shadow-xl shadow-black/40 py-1">
                {NAV_BOTTOM_ITEMS.map(({ to, key, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={navClass}
                    onClick={() => setMenuOpen(false)}
                    onMouseEnter={() => prefetchForRoute(qc, to)}
                  >
                    <Icon className="h-4 w-4 opacity-80 shrink-0" />
                    {t(key)}
                  </NavLink>
                ))}
              </div>
            </>
          )}

          <div className="relative z-20 p-4 flex items-center justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-white/70 truncate">{username}</span>
              <span className="text-xs text-white/30">{t('active_session')}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className={`p-2 transition-colors rounded-md ${menuOpen ? 'bg-white/10 text-white/90' : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}
                title={t('menu_title')}
                aria-label={t('menu_title')}
                aria-expanded={menuOpen}
              >
                <Settings
                  className={`h-5 w-5 transition-transform duration-200 ${menuOpen ? 'rotate-45' : ''}`}
                />
              </button>
              <button
                type="button"
                onClick={() => logout.mutate()}
                className="p-2 text-white/30 hover:text-red-400/80 transition-colors rounded-md hover:bg-white/5"
                title={t('logout_title')}
                aria-label={t('logout_title')}
              >
                <Power className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        <VersionStatus />
      </aside>
    </>
  );
}
