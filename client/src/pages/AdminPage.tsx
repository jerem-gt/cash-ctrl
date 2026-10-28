import type { UserPublic } from '@cashctrl/types';
import { Loader2, LockOpen, Pencil, Plus, ShieldMinus, ShieldPlus, Trash2, X } from 'lucide-react';
import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { UserUpdatePayload } from '@/api/client';
import { Button, Card, Input, Select, showToast } from '@/components/ui';
import { useDeleteConfirmation } from '@/features/settings/hooks/useDeleteConfirmation';
import { useMe } from '@/hooks/useAuth';
import {
  useCreateUser,
  useDeleteUser,
  useDisableUser2fa,
  useUpdateUser,
  useUsers,
} from '@/hooks/useUsers';
import { fmtDate } from '@/lib/format';

const badgeClass =
  'text-[10px] font-medium uppercase tracking-wide bg-surface-emphasis text-content-muted border border-line rounded px-1.5 py-0.5';

// ─── Add user form ─────────────────────────────────────────────────────────────

function AddUserForm({ onClose }: Readonly<{ onClose: () => void }>) {
  const { t } = useTranslation('admin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const create = useCreateUser();

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    create.mutate(
      {
        username,
        password,
        lang,
        ...(trimmedEmail === '' ? {} : { email: trimmedEmail }),
      },
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
        type="email"
        placeholder={t('add_form.email_placeholder')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
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
  const [email, setEmail] = useState(user.email ?? '');
  const [password, setPassword] = useState('');
  const update = useUpdateUser();

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const payload: UserUpdatePayload = {};
    if (username !== user.username) payload.username = username;
    const trimmedEmail = email.trim();
    if (trimmedEmail !== (user.email ?? ''))
      payload.email = trimmedEmail === '' ? null : trimmedEmail;
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
        type="email"
        placeholder={t('edit_form.email_placeholder')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
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

export default function AdminPage() {
  const { t } = useTranslation('admin');
  const { data: me } = useMe();
  const { data: users = [], isLoading } = useUsers();
  const deleteUser = useDeleteUser();
  const updateUser = useUpdateUser();
  const disable2fa = useDisableUser2fa();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { requestDelete, isDeleting, deleteConfirmModal } = useDeleteConfirmation(showToast);
  const { requestDelete: request2faDisable, deleteConfirmModal: disable2faModal } =
    useDeleteConfirmation(showToast);

  const handleDelete = (user: UserPublic) => {
    requestDelete(
      t('user.confirm_delete_title'),
      t('user.confirm_delete', { username: user.username }),
      user.id,
      deleteUser.mutate,
      t('toasts.deleted'),
    );
  };

  const handleDisable2fa = (user: UserPublic) => {
    request2faDisable(
      t('user.confirm_2fa_title'),
      t('user.confirm_2fa', { username: user.username }),
      user.id,
      disable2fa.mutate,
      t('toasts.totp_disabled'),
    );
  };

  const handleToggleAdmin = (user: UserPublic) => {
    const promote = user.is_admin === 0;
    updateUser.mutate(
      { id: user.id, is_admin: promote },
      { onSuccess: () => showToast(promote ? t('toasts.promoted') : t('toasts.demoted')) },
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display tracking-tight">{t('page.title')}</h1>
          <p className="text-sm text-content-subtle">{t('page.subtitle')}</p>
        </div>
        {!showAdd && (
          <Button
            size="sm"
            variant="primary"
            className="shrink-0"
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

      <Card>
        {showAdd && (
          <div className="mb-4 p-4 bg-surface-muted rounded-xl border border-line-subtle">
            <AddUserForm onClose={() => setShowAdd(false)} />
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-content-subtle">{t('page.loading')}</p>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {users.map((user) => {
              const isSelf = user.username === me?.username;
              return (
                <li key={user.id} className="py-3">
                  {editingId === user.id ? (
                    <div className="p-3 bg-surface-muted rounded-xl border border-line-subtle">
                      <EditUserForm user={user} onClose={() => setEditingId(null)} />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-content break-all">
                            {user.username}
                          </span>
                          {isSelf && (
                            <span className="text-[11px] text-content-subtle">
                              ({t('user.you')})
                            </span>
                          )}
                          {user.is_admin === 1 && (
                            <span className={badgeClass}>{t('user.admin_badge')}</span>
                          )}
                          {user.totp_enabled === 1 && (
                            <span className={badgeClass}>{t('user.totp_badge')}</span>
                          )}
                        </div>
                        <span className="text-xs text-content-muted break-all">
                          {user.email ?? t('user.no_email')}
                        </span>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-content-subtle">
                          <span>{t('user.account_count', { count: user.account_count })}</span>
                          <span>{t('user.tx_count', { count: user.tx_count })}</span>
                          {user.last_tx_date !== null && (
                            <span>{t('user.last_tx', { date: fmtDate(user.last_tx_date) })}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingId(user.id);
                            setShowAdd(false);
                          }}
                          disabled={isDeleting}
                          title={t('user.edit_title')}
                          aria-label={t('user.edit_title')}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {!isSelf && (
                          <Button
                            size="sm"
                            onClick={() => handleToggleAdmin(user)}
                            disabled={updateUser.isPending}
                            title={
                              user.is_admin === 1 ? t('user.demote_title') : t('user.promote_title')
                            }
                            aria-label={
                              user.is_admin === 1 ? t('user.demote_title') : t('user.promote_title')
                            }
                          >
                            {user.is_admin === 1 ? (
                              <ShieldMinus className="h-3.5 w-3.5" />
                            ) : (
                              <ShieldPlus className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        {user.totp_enabled === 1 && (
                          <Button
                            size="sm"
                            onClick={() => handleDisable2fa(user)}
                            disabled={disable2fa.isPending}
                            title={t('user.disable_2fa_title')}
                            aria-label={t('user.disable_2fa_title')}
                          >
                            <LockOpen className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {!isSelf && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(user)}
                            disabled={isDeleting}
                            title={t('user.delete_title')}
                            aria-label={t('user.delete_title')}
                          >
                            {isDeleting && deleteUser.variables === user.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {deleteConfirmModal}
      {disable2faModal}
    </div>
  );
}
