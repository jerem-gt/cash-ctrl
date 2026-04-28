import { type SubmitEvent, useState } from 'react';

import { Button, FormGroup, Input } from '@/components/ui';
import { VersionStatus } from '@/components/VersionStatus.tsx';
import { useLogin } from '@/hooks/useAuth';
import { appName } from '@/lib/appname.ts';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    login.reset();
    login.mutate({ username, password });
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
      <div className="bg-white border border-black/[0.07] rounded-2xl p-8 w-full max-w-sm shadow-lg">
        <h1 className="font-serif text-2xl mb-1">{appName()}</h1>
        <p className="text-sm text-stone-400 mb-7">Connectez-vous pour accéder à vos comptes</p>

        {login.error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-3 py-2 rounded-lg mb-5">
            {login.error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormGroup label="Identifiant" htmlFor="username" className="flex-none min-w-0">
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="admin"
              autoFocus
              required
            />
          </FormGroup>
          <FormGroup label="Mot de passe" htmlFor="password" className="flex-none min-w-0">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </FormGroup>
          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={!username || !password || login.isPending}
          >
            {login.isPending ? 'Connexion…' : 'Se connecter'}
          </Button>
          <VersionStatus />
        </form>
      </div>
    </div>
  );
}
