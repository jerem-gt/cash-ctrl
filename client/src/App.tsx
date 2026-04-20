import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMe } from '@/hooks/useAuth';
import { Sidebar } from '@/components/Sidebar';
import { Toast } from '@/components/ui';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { TransactionsPage } from '@/pages/TransactionsPage';
import { AccountsPage } from '@/pages/AccountsPage';
import { AccountDetailPage } from '@/pages/AccountDetailPage';
import { ExportPage } from '@/pages/ExportPage';
import { SettingsPage } from '@/pages/SettingsPage';

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: false },
  },
});

function AppShell() {
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
      <Sidebar username={me.username} />
      <main className="ml-56 flex-1 p-9 max-w-[calc(100vw-14rem)]">
        <Routes>
          <Route path="/"             element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/accounts"     element={<AccountsPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route path="/export"       element={<ExportPage />} />
          <Route path="/settings"     element={<SettingsPage />} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
