import { useState, type SubmitEvent } from 'react';
import { useChangePassword } from '@/hooks/useAuth';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/useCategories';
import { Card, CardTitle, Button, Input, FormGroup, ConfirmModal, showToast } from '@/components/ui';
import type { Category } from '@/types';

function CategoryRow({ cat, onSaved, onDelete }: {
  cat: Category;
  onSaved: () => void;
  onDelete: (id: number) => void;
}) {
  const updateCategory = useUpdateCategory();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: cat.name, color: cat.color });

  const handleSave = (e: SubmitEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    updateCategory.mutate({ id: cat.id, name: form.name.trim(), color: form.color }, {
      onSuccess: () => { setEditing(false); onSaved(); },
      onError: err => showToast(err.message),
    });
  };

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex items-center gap-2 py-2 border-b border-black/[0.06] last:border-0">
        <input
          type="color"
          value={form.color}
          onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
          className="w-7 h-7 rounded cursor-pointer border border-black/10 p-0.5 shrink-0"
        />
        <Input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="flex-1 text-sm"
          autoFocus
        />
        <Button type="submit" variant="primary" size="sm" disabled={updateCategory.isPending}>
          {updateCategory.isPending ? '…' : 'OK'}
        </Button>
        <Button type="button" size="sm" onClick={() => setEditing(false)}>Annuler</Button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-black/[0.06] last:border-0 group">
      <div className="w-3.5 h-3.5 rounded-sm shrink-0" style={{ background: cat.color }} />
      <span className="flex-1 text-sm">{cat.name}</span>
      <button
        onClick={() => { setForm({ name: cat.name, color: cat.color }); setEditing(true); }}
        className="text-xs text-stone-400 hover:text-stone-700 transition-colors opacity-0 group-hover:opacity-100"
      >
        Modifier
      </button>
      <button
        onClick={() => onDelete(cat.id)}
        className="text-xs text-stone-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

export function SettingsPage() {
  const changePassword = useChangePassword();
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });

  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const [newCat, setNewCat] = useState({ name: '', color: '#9E9A92' });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handlePasswordSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { showToast('Les mots de passe ne correspondent pas.'); return; }
    if (pwForm.next.length < 8) { showToast('Minimum 8 caractères.'); return; }
    changePassword.mutate({ current: pwForm.current, next: pwForm.next }, {
      onSuccess: () => {
        setPwForm({ current: '', next: '', confirm: '' });
        showToast('Mot de passe mis à jour ✓');
      },
      onError: e => showToast(e.message),
    });
  };

  const handleAddCategory = (e: SubmitEvent) => {
    e.preventDefault();
    if (!newCat.name.trim()) { showToast('Donnez un nom à la catégorie.'); return; }
    createCategory.mutate({ name: newCat.name.trim(), color: newCat.color }, {
      onSuccess: () => {
        setNewCat({ name: '', color: '#9E9A92' });
        showToast('Catégorie ajoutée ✓');
      },
      onError: err => showToast(err.message),
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteId) return;
    deleteCategory.mutate(deleteId, {
      onSuccess: () => { setDeleteId(null); showToast('Catégorie supprimée'); },
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">Paramètres</h2>
        <p className="text-sm text-stone-400 mt-0.5">Gestion du compte</p>
      </div>

      {/* Categories */}
      <Card>
        <CardTitle>Catégories</CardTitle>
        <div className="mb-4">
          {categories.length === 0
            ? <p className="text-sm text-stone-400 py-2">Aucune catégorie.</p>
            : categories.map(cat => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  onSaved={() => showToast('Catégorie mise à jour ✓')}
                  onDelete={setDeleteId}
                />
              ))
          }
        </div>
        <form onSubmit={handleAddCategory} className="flex gap-2 items-end flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-stone-500 font-medium">Couleur</label>
            <input
              type="color"
              value={newCat.color}
              onChange={e => setNewCat(f => ({ ...f, color: e.target.value }))}
              className="w-7 h-7 rounded cursor-pointer border border-black/10 p-0.5"
            />
          </div>
          <FormGroup label="Nom">
            <Input
              type="text"
              value={newCat.name}
              onChange={e => setNewCat(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex : Vacances"
              className="min-w-44"
            />
          </FormGroup>
          <Button type="submit" variant="primary" disabled={createCategory.isPending}>
            {createCategory.isPending ? '…' : 'Ajouter'}
          </Button>
        </form>
      </Card>

      {/* Password */}
      <Card className="max-w-sm">
        <CardTitle>Changer le mot de passe</CardTitle>
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <FormGroup label="Mot de passe actuel">
            <Input type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} autoComplete="current-password" />
          </FormGroup>
          <FormGroup label="Nouveau mot de passe">
            <Input type="password" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} placeholder="Min. 8 caractères" autoComplete="new-password" />
          </FormGroup>
          <FormGroup label="Confirmer">
            <Input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} autoComplete="new-password" />
          </FormGroup>
          <Button type="submit" variant="primary" disabled={changePassword.isPending} className="mt-2">
            {changePassword.isPending ? '…' : 'Mettre à jour'}
          </Button>
        </form>
      </Card>

      {deleteId && (
        <ConfirmModal
          title="Supprimer la catégorie"
          body="Les transactions existantes garderont leur catégorie actuelle. Confirmer ?"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
