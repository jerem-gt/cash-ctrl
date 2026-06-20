import type { UserPublic } from '@cashctrl/types';
import { Loader2, LogOut, Pencil, Plus, Shield, Trash2, X } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Card, CardTitle, Input, Select, showToast } from '@/components/ui';
import { APP_CONFIG } from '@/constants';
import { useLogout } from '@/hooks/useAuth';
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from '@/hooks/useUsers';
import { fmtDate } from '@/lib/format';

// ─── Add user form ─────────────────────────────────────────────────────────────

function AddUserForm({ onClose }: Readonly<{ onClose: () => void }>) {
  const { t } = useTranslation('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const create = useCreateUser();

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    create.mutate(
      { username, password, lang },
      {
        onSuccess: () => {
          showToast(t('toasts.created'));
          onClose();
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-content">{t('add_form.title')}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-content-subtle hover:text-content-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <Input
        placeholder={t('add_form.username_placeholder')}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        autoFocus
      />
      <Input
        type="password"
        placeholder={t('add_form.password_placeholder')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
      />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-content-muted">{t('add_form.language_label')}</label>
        <Select
          value={lang}
          onChange={(e) => setLang(e.target.value as 'fr' | 'en')}
          aria-label={t('add_form.language_label')}
        >
          <option value="fr">{t('add_form.language_fr')}</option>
          <option value="en">{t('add_form.language_en')}</option>
        </Select>
      </div>
      <Button type="submit" variant="primary" disabled={create.isPending}>
        {t('add_form.submit')}
      </Button>
    </form>
  );
}

// ─── Edit user form ────────────────────────────────────────────────────────────

function EditUserForm({ user, onClose }: Readonly<{ user: UserPublic; onClose: () => void }>) {
  const { t } = useTranslation('admin');
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
          showToast(t('toasts.updated'));
          onClose();
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-content">
          {t('edit_form.title', { username: user.username })}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-content-subtle hover:text-content-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <Input
        placeholder={t('edit_form.username_placeholder')}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder={t('edit_form.password_placeholder')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
      />
      <Button type="submit" variant="primary" disabled={update.isPending}>
        {t('edit_form.submit')}
      </Button>
    </form>
  );
}

// ─── Main admin page ───────────────────────────────────────────────────────────

export function AdminPage({ username }: Readonly<{ username: string }>) {
  const { t } = useTranslation('admin');
  const { data: users = [], isLoading } = useUsers();
  const deleteUser = useDeleteUser();
  const logout = useLogout();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleDelete = (user: UserPublic) => {
    if (!confirm(t('user.confirm_delete', { username: user.username }))) return;
    deleteUser.mutate(user.id, {
      onSuccess: () => showToast(t('toasts.deleted')),
    });
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="bg-sidebar-bg text-sidebar-fg px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-white/50" />
          <span className="font-semibold">
            {APP_CONFIG.name} {t('page.title_suffix')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/50">{username}</span>
          <button
            onClick={() => logout.mutate()}
            className="text-white/50 hover:text-white transition-colors"
            title={t('page.logout_title')}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>{t('page.users_title')}</CardTitle>
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
                {t('page.add_btn')}
              </Button>
            )}
          </div>

          {showAdd && (
            <div className="mb-4 p-4 bg-surface-muted rounded-xl border border-line-subtle">
              <AddUserForm onClose={() => setShowAdd(false)} />
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-content-subtle">{t('page.loading')}</p>
          ) : (
            <ul className="divide-y divide-line-subtle">
              {users.map((user) => (
                <li key={user.id} className="py-3">
                  {editingId === user.id ? (
                    <div className="p-3 bg-surface-muted rounded-xl border border-line-subtle">
                      <EditUserForm user={user} onClose={() => setEditingId(null)} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-content">{user.username}</span>
                          {user.is_admin === 1 && (
                            <span className="text-[10px] font-medium uppercase tracking-wide bg-surface-emphasis text-content-muted border border-line rounded px-1.5 py-0.5">
                              {t('user.admin_badge')}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-content-subtle">
                          <span>{t('user.account_count', { count: user.account_count })}</span>
                          <span>{t('user.tx_count', { count: user.tx_count })}</span>
                          {user.last_tx_date !== null && (
                            <span>{t('user.last_tx', { date: fmtDate(user.last_tx_date) })}</span>
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
                            title={t('user.edit_title')}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(user)}
                            disabled={deleteUser.isPending}
                            title={t('user.delete_title')}
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
