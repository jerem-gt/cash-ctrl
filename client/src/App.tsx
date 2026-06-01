import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Menu } from 'lucide-react';
import type { ErrorInfo, ReactNode } from 'react';
import { Component, lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { Sidebar } from '@/components/Sidebar';
import { Card, Skeleton, Toast } from '@/components/ui';
import { APP_CONFIG } from '@/constants.ts';
import { useAppVersion } from '@/hooks/useAppVersion.ts';
import { useMe } from '@/hooks/useAuth';
import { routeChunk } from '@/lib/routeChunks';
import { AdminPage } from '@/pages/AdminPage';
import { LoginPage } from '@/pages/LoginPage';

// Recharge la page si un chunk hashé n'existe plus (déploiement PWA)
function lazyLoad<T extends { default: React.ComponentType }>(factory: () => Promise<T>) {
  return lazy(() =>
    factory().catch(() => {
      globalThis.location.reload();
      return new Promise<T>(() => {});
    }),
  );
}

const DashboardPage = lazyLoad(routeChunk['/']);
const TransactionsPage = lazyLoad(routeChunk['/transactions']);
const AccountsPage = lazyLoad(routeChunk['/accounts']);
const AccountDetailPage = lazyLoad(routeChunk['/accounts/:id']);
const SettingsPage = lazyLoad(routeChunk['/settings']);
const ScheduledPage = lazyLoad(routeChunk['/scheduled']);

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('App render error:', error, info);
  }
  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-canvas">
          <button
            className="text-sm text-stone-500 underline"
            onClick={() => globalThis.location.reload()}
          >
            Une erreur est survenue — cliquez pour recharger
          </button>
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppShell() {
  const { t } = useTranslation('sidebar');
  const { t: tc } = useTranslation('common');
  // Ajoute (dev) au titre si on est hors production
  const { isDev } = useAppVersion();
  useEffect(() => {
    document.title = APP_CONFIG.name + (isDev ? ' (dev)' : '');
  }, [isDev]);

  const { data: me, isLoading } = useMe();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <p className="text-sm text-stone-400">{tc('loading_text')}</p>
      </div>
    );
  }

  if (!me) return <LoginPage />;

  if (me.isAdmin) return <AdminPage username={me.username} />;

  return (
    <div className="flex min-h-screen bg-canvas overflow-x-hidden">
      <ScrollToTop />
      <Sidebar username={me.username} mobileOpen={sidebarOpen} onMobileClose={closeSidebar} />
      <main className="md:ml-72 flex-1 min-w-0 p-4 md:p-9 md:max-w-[calc(100vw-18rem)]">
        <div className="flex items-center gap-3 mb-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md hover:bg-stone-200 transition-colors"
            aria-label={t('open_menu')}
          >
            <Menu className="h-5 w-5 text-stone-600" />
          </button>
          <span className="text-lg font-bold text-stone-800">{APP_CONFIG.name}</span>
        </div>
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="space-y-5 animate-pulse">
                <div className="space-y-1.5">
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <Card key={i} size="sm">
                      <Skeleton className="h-3 w-20 mb-3" />
                      <Skeleton className="h-7 w-28" />
                    </Card>
                  ))}
                </div>
                <Card>
                  <Skeleton className="h-3 w-40 mb-4" />
                  <div className="space-y-3">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-11" />
                    ))}
                  </div>
                </Card>
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/accounts/:id" element={<AccountDetailPage />} />
              <Route path="/scheduled" element={<ScheduledPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
        <Toast />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
