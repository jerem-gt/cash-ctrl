import type { TransactionType } from '@cashctrl/types';
import {
  BarChart2,
  Calendar,
  Home,
  LayoutGrid,
  Search,
  Settings,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Badge, Empty } from '@/components/ui';
import { useGlobalSearch } from '@/features/search/hooks/useGlobalSearch';
import { useLogoMap } from '@/hooks/useLogoMap';
import { fmtCurrency, fmtDateShort } from '@/lib/format';
import { useDebouncedSync } from '@/lib/useDebouncedSync';

interface Props {
  onClose: () => void;
}

interface PageEntry {
  to: string;
  label: string;
  icon: typeof Home;
}

/** Normalise pour un match insensible aux accents/casse, purement client-side. */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function amountClass(type: TransactionType): string {
  return type === 'income' ? 'text-success' : 'text-danger';
}

function amountSign(type: TransactionType): string {
  return type === 'income' ? '+' : '−';
}

interface Row {
  id: string;
  onSelect: () => void;
  content: ReactNode;
}

interface Group {
  key: string;
  label: string;
  rows: Row[];
}

export function CommandPalette({ onClose }: Readonly<Props>) {
  const { t } = useTranslation('search');
  const { t: tSidebar } = useTranslation('sidebar');
  const { t: tDashboard } = useTranslation('dashboard');
  const navigate = useNavigate();
  const logoMap = useLogoMap();

  const pages: PageEntry[] = useMemo(
    () => [
      { to: '/', label: tDashboard('title'), icon: Home },
      { to: '/transactions', label: tSidebar('all_transactions'), icon: LayoutGrid },
      { to: '/accounts', label: tSidebar('accounts_section'), icon: Wallet },
      { to: '/scheduled', label: tSidebar('scheduled'), icon: Calendar },
      { to: '/reports', label: tSidebar('reports'), icon: BarChart2 },
      { to: '/settings', label: tSidebar('settings'), icon: Settings },
    ],
    [tSidebar, tDashboard],
  );

  const [inputValue, setInputValue] = useState('');
  const [query, setQuery] = useState('');
  useDebouncedSync(inputValue, (s) => s.trim(), query, setQuery, 300);

  const { data, isLoading } = useGlobalSearch(query);

  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const goTo = useCallback(
    (to: string, state?: unknown) => {
      onClose();
      // Promise.resolve + catch no-op : concilie no-floating-promises (ESLint) et l'interdiction de `void` (Sonar).
      Promise.resolve(navigate(to, state ? { state } : undefined)).catch(() => undefined);
    },
    [onClose, navigate],
  );

  const filteredPages = useMemo(() => {
    const term = normalize(inputValue.trim());
    return pages.filter((p) => normalize(p.label).includes(term));
  }, [inputValue, pages]);

  const groups: Group[] = useMemo(() => {
    const accounts: Row[] = (data?.accounts ?? []).map((a) => ({
      id: `account-${a.id}`,
      onSelect: () => goTo(`/accounts/${a.id}`),
      content: (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {a.bank && logoMap[a.bank] ? (
            <img
              src={logoMap[a.bank] ?? undefined}
              alt=""
              className="w-4 h-4 object-contain rounded shrink-0"
            />
          ) : (
            <span className="w-4 h-4 rounded bg-surface-emphasis shrink-0" />
          )}
          <span className="truncate text-sm">{a.name}</span>
          {a.closed_at !== null && <Badge variant="stone">{t('closed_badge')}</Badge>}
        </div>
      ),
    }));

    const transactions: Row[] = (data?.transactions ?? []).map((tx) => ({
      id: `transaction-${tx.id}`,
      onSelect: () => goTo(`/transactions?q=${encodeURIComponent(query)}`),
      content: (
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm">{tx.description}</p>
            <p className="text-[11px] text-content-subtle">{fmtDateShort(tx.date)}</p>
          </div>
          <span className={`text-sm font-medium tabular-nums shrink-0 ${amountClass(tx.type)}`}>
            {amountSign(tx.type)}
            {fmtCurrency(tx.amount)}
          </span>
        </div>
      ),
    }));

    const scheduled: Row[] = (data?.scheduled ?? []).map((s) => ({
      id: `scheduled-${s.id}`,
      onSelect: () => goTo('/scheduled', { highlightScheduledId: s.id }),
      content: (
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="h-3.5 w-3.5 text-content-subtle shrink-0" />
            <span className="truncate text-sm">{s.description}</span>
            {s.active === 0 && <Badge variant="stone">{t('inactive_badge')}</Badge>}
          </div>
          <span className={`text-sm font-medium tabular-nums shrink-0 ${amountClass(s.type)}`}>
            {amountSign(s.type)}
            {fmtCurrency(s.amount)}
          </span>
        </div>
      ),
    }));

    const stocks: Row[] = (data?.stocks ?? []).map((s) => ({
      id: `stock-${s.id}`,
      onSelect: () => goTo(`/accounts/${s.account_id}`),
      content: (
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <TrendingUp className="h-3.5 w-3.5 text-content-subtle shrink-0" />
          <span className="truncate text-sm">{s.ticker}</span>
        </div>
      ),
    }));

    const pageRows: Row[] = filteredPages.map((p) => {
      const Icon = p.icon;
      return {
        id: `page-${p.to}`,
        onSelect: () => goTo(p.to),
        content: (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icon className="h-3.5 w-3.5 text-content-subtle shrink-0" />
            <span className="truncate text-sm">{p.label}</span>
          </div>
        ),
      };
    });

    return [
      { key: 'accounts', label: t('groups.accounts'), rows: accounts },
      { key: 'transactions', label: t('groups.transactions'), rows: transactions },
      { key: 'scheduled', label: t('groups.scheduled'), rows: scheduled },
      { key: 'stocks', label: t('groups.stocks'), rows: stocks },
      { key: 'pages', label: t('groups.pages'), rows: pageRows },
    ].filter((g) => g.rows.length > 0);
  }, [data, filteredPages, logoMap, query, t, goTo]);

  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  // Ramène la sélection en tête de liste quand la recherche validée change
  // (pattern "adjusting state during render", cf. react.dev/learn/you-might-not-need-an-effect).
  const [lastQueryForReset, setLastQueryForReset] = useState(query);
  if (lastQueryForReset !== query) {
    setLastQueryForReset(query);
    setActiveIndex(0);
  }
  // Filet de sécurité si la liste rétrécit sans que `query` ait changé (ex. filtrage des pages).
  const clampedActiveIndex = Math.min(Math.max(activeIndex, 0), flat.length - 1);

  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-index="${clampedActiveIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [clampedActiveIndex]);

  // Capture + stopPropagation : Escape ferme la palette sans atteindre une ModalFrame sous-jacente, même hors focus input.
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const isIdle = query.trim().length < 2;
  const isLoadingResults = !isIdle && isLoading;
  const isEmpty = !isIdle && !isLoadingResults && flat.length === 0;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(Math.min(clampedActiveIndex + 1, flat.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(Math.max(clampedActiveIndex - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      flat[clampedActiveIndex]?.onSelect();
    }
  };

  let index = -1;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex items-start justify-center md:items-center md:bg-black/35 md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className="flex flex-col w-full h-full md:h-auto md:max-h-[70vh] md:max-w-xl bg-surface md:rounded-2xl md:shadow-xl md:border md:border-line-subtle overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line-subtle shrink-0">
          <Search className="h-4 w-4 text-content-subtle shrink-0" aria-hidden="true" />
          <input
            autoFocus
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-content-faint"
          />
          <button
            type="button"
            onClick={onClose}
            className="md:hidden shrink-0"
            aria-label={t('aria_close')}
          >
            <X className="h-4 w-4 text-content-subtle" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoadingResults && (
            <div className="p-4 text-sm text-content-subtle">{t('loading')}</div>
          )}

          {!isLoadingResults &&
            groups.map((group) => (
              <div key={group.key} className="py-1">
                <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-content-subtle">
                  {group.label}
                </p>
                {group.rows.map((row) => {
                  index += 1;
                  const rowIndex = index;
                  const isActive = rowIndex === clampedActiveIndex;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      aria-current={isActive || undefined}
                      data-index={rowIndex}
                      // onMouseMove (pas Enter) : le hover synthétique d'une liste apparue sous un curseur immobile ne doit pas voler la sélection
                      onMouseMove={() => setActiveIndex(rowIndex)}
                      onClick={row.onSelect}
                      className={`flex items-center w-full text-left px-4 py-2 transition-colors ${
                        isActive ? 'bg-surface-muted' : ''
                      }`}
                    >
                      {row.content}
                    </button>
                  );
                })}
              </div>
            ))}

          {isEmpty && <Empty>{t('empty')}</Empty>}
          {isIdle && <p className="px-4 py-3 text-xs text-content-faint">{t('hint_idle')}</p>}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-line-subtle text-[11px] text-content-faint shrink-0">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-line bg-surface-muted">↑↓</kbd>
            {t('hints.navigate')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-line bg-surface-muted">↵</kbd>
            {t('hints.open')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-line bg-surface-muted">esc</kbd>
            {t('hints.close')}
          </span>
        </div>
      </div>
    </div>
  );
}
