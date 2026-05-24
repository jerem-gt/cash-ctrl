import { useState } from 'react';

import { Button, showToast } from '@/components/ui';
import { useAccounts } from '@/hooks/useAccounts';

async function downloadExport(path: string, filename: string, setLoading: (v: boolean) => void) {
  setLoading(true);
  try {
    const res = await fetch(path);
    if (!res.ok) {
      showToast(`Erreur serveur (${res.status})`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast((err as Error).message);
  } finally {
    setLoading(false);
  }
}

export default function ExportManager() {
  const { data: accounts = [] } = useAccounts();
  const [pending, setPending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);

  const date = new Date().toISOString().split('T')[0];
  const allSelected = accounts.length > 0 && selectedIds.size === accounts.length;

  const toggleAccount = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(accounts.map((a) => a.id)));

  const handleOpen = () => {
    if (!panelOpen) setSelectedIds(new Set(accounts.map((a) => a.id)));
    setPanelOpen((v) => !v);
  };

  const handleDownload = () => {
    const ids = selectedIds.size > 0 ? [...selectedIds].join(',') : undefined;
    const qs = ids ? `?accountIds=${ids}` : '';
    downloadExport(`/api/export/json-full${qs}`, `cashctrl-full-${date}.json`, setPending);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-stone-400 mb-8">
        Exportez toutes vos données au format JSON CashCtrl.
      </p>

      <Button variant="export" onClick={handleOpen}>
        {panelOpen ? '✕ Fermer' : '⬇ Exporter…'}
      </Button>

      {panelOpen && (
        <div className="border border-stone-200 rounded-xl p-4 bg-stone-50 space-y-4">
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-widest mb-3">
              Comptes à exporter
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded"
                />
                <span className="font-medium">Tout sélectionner</span>
              </label>
              <div className="border-t border-stone-200 pt-2 space-y-1.5 pl-1">
                {accounts.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(a.id)}
                      onChange={() => toggleAccount(a.id)}
                      className="rounded"
                    />
                    <span>{a.name}</span>
                    {a.bank && <span className="text-xs text-stone-400">— {a.bank}</span>}
                    {a.closed_at && <span className="text-xs text-stone-300 italic">fermé</span>}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-stone-400">
              {selectedIds.size} compte{selectedIds.size === 1 ? '' : 's'} · catégories et moyens de
              paiement toujours inclus
            </p>
            <Button
              variant="primary"
              disabled={pending || selectedIds.size === 0}
              onClick={handleDownload}
            >
              {pending ? '…' : `⬇ Télécharger (${selectedIds.size})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
