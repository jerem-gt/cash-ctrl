import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { Sidebar } from '@/components/Sidebar';
import { Card, Skeleton, Toast } from '@/components/ui';
import { APP_CONFIG } from '@/constants.ts';
import { useAppVersion } from '@/hooks/useAppVersion.ts';
import { useMe } from '@/hooks/useAuth';
import { LoginPage } from '@/pages/LoginPage';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage'));
const AccountsPage = lazy(() => import('@/pages/AccountsPage'));
const AccountDetailPage = lazy(() => import('@/pages/AccountDetailPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const ScheduledPage = lazy(() => import('@/pages/ScheduledPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppShell() {
  // Ajoute (dev) au titre si on est hors production
  const { isDev } = useAppVersion();
  useEffect(() => {
    document.title = APP_CONFIG.name + (isDev ? ' (dev)' : '');
  }, [isDev]);

  const { data: me, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <p className="text-sm text-stone-400">Chargement…</p>
      </div>
    );
  }

  if (!me) return <LoginPage />;

  return (
    <div className="flex min-h-screen bg-stone-100">
      <ScrollToTop />
      <Sidebar username={me.username} />
      <main className="ml-72 flex-1 p-9 max-w-[calc(100vw-18rem)]">
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
