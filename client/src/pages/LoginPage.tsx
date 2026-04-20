import { useState, type SubmitEvent } from 'react';
import { useLogin } from '@/hooks/useAuth';
import { Button, Input } from '@/components/ui';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    login.mutate({ username, password });
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
      <div className="bg-white border border-black/[0.07] rounded-2xl p-8 w-full max-w-sm shadow-lg">
        <h1 className="font-serif text-2xl mb-1">CashCtrl</h1>
        <p className="text-sm text-stone-400 mb-7">Connectez-vous pour accéder à vos comptes</p>

        {login.error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-3 py-2 rounded-lg mb-5">
            {login.error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-stone-400">Identifiant</label>
            <Input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="admin"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wider text-stone-400">Mot de passe</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={login.isPending}
          >
            {login.isPending ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>
      </div>
    </div>
  );
}
