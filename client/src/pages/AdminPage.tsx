import { Loader2, LogOut, Pencil, Plus, Shield, Trash2, X } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';

import { Button, Card, CardTitle, Input, showToast } from '@/components/ui';
import { APP_CONFIG } from '@/constants';
import { useLogout } from '@/hooks/useAuth';
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from '@/hooks/useUsers';
import type { UserPublic } from '@/types';

// ─── Add user form ─────────────────────────────────────────────────────────────

function AddUserForm({ onClose }: Readonly<{ onClose: () => void }>) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const create = useCreateUser();

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    create.mutate(
      { username, password },
      {
        onSuccess: () => {
          showToast('Utilisateur créé');
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-stone-800">Nouvel utilisateur</p>
        <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <Input
        placeholder="Nom d'utilisateur"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        autoFocus
      />
      <Input
        type="password"
        placeholder="Mot de passe (min. 8 caractères)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
      />
      <Button type="submit" variant="primary" disabled={create.isPending}>
        Créer
      </Button>
    </form>
  );
}

// ─── Edit user form ────────────────────────────────────────────────────────────

function EditUserForm({ user, onClose }: Readonly<{ user: UserPublic; onClose: () => void }>) {
  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState('');
  const update = useUpdateUser();

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const payload: { username?: string; password?: string } = {};
    if (username !== user.username) payload.username = username;
    if (password.length > 0) payload.password = password;

    update.mutate(
      { id: user.id, ...payload },
      {
        onSuccess: () => {
          showToast('Utilisateur modifié');
          onClose();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-stone-800">Modifier {user.username}</p>
        <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <Input
        placeholder="Nom d'utilisateur"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Nouveau mot de passe (laisser vide = inchangé)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
      />
      <Button type="submit" variant="primary" disabled={update.isPending}>
        Enregistrer
      </Button>
    </form>
  );
}

// ─── Main admin page ───────────────────────────────────────────────────────────

export function AdminPage({ username }: Readonly<{ username: string }>) {
  const { data: users = [], isLoading } = useUsers();
  const deleteUser = useDeleteUser();
  const logout = useLogout();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleDelete = (user: UserPublic) => {
    if (!confirm(`Supprimer l'utilisateur "${user.username}" et toutes ses données ?`)) return;
    deleteUser.mutate(user.id, {
      onSuccess: () => showToast('Utilisateur supprimé'),
      onError: (err) => showToast(err.message),
    });
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col">
      <header className="bg-stone-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-stone-400" />
          <span className="font-semibold">{APP_CONFIG.name} — Administration</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-stone-400">{username}</span>
          <button
            onClick={() => logout.mutate()}
            className="text-stone-400 hover:text-white transition-colors"
            title="Se déconnecter"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Utilisateurs</CardTitle>
            {!showAdd && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setShowAdd(true);
                  setEditingId(null);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Ajouter
              </Button>
            )}
          </div>

          {showAdd && (
            <div className="mb-4 p-4 bg-stone-50 rounded-xl border border-black/[0.07]">
              <AddUserForm onClose={() => setShowAdd(false)} />
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-stone-400">Chargement…</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {users.map((user) => (
                <li key={user.id} className="py-3">
                  {editingId === user.id ? (
                    <div className="p-3 bg-stone-50 rounded-xl border border-black/[0.07]">
                      <EditUserForm user={user} onClose={() => setEditingId(null)} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-stone-800">
                            {user.username}
                          </span>
                          {user.is_admin === 1 && (
                            <span className="text-[10px] font-medium uppercase tracking-wide bg-stone-100 text-stone-500 border border-stone-200 rounded px-1.5 py-0.5">
                              admin
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-stone-400">
                          <span>
                            {user.account_count} compte{user.account_count === 1 ? '' : 's'}
                          </span>
                          <span>
                            {user.tx_count} transaction{user.tx_count === 1 ? '' : 's'}
                          </span>
                          {user.last_tx_date !== null && (
                            <span>
                              dernière le {new Date(user.last_tx_date).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </div>
                      </div>
                      {user.is_admin === 0 && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => {
                              setEditingId(user.id);
                              setShowAdd(false);
                            }}
                            disabled={deleteUser.isPending}
                            title="Modifier"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(user)}
                            disabled={deleteUser.isPending}
                            title="Supprimer"
                          >
                            {deleteUser.isPending && deleteUser.variables === user.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
