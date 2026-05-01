import { useState } from 'react';

import { Button, showToast } from '@/components/ui.tsx';

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
  const [csvPending, setCsvPending] = useState(false);
  const [jsonPending, setJsonPending] = useState(false);

  const date = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-5">
      <p className="text-sm text-stone-500 mb-4">
        Exportez toutes vos transactions dans le format de votre choix.
      </p>
      <div className="flex gap-3 flex-wrap">
        <Button
          variant="export"
          disabled={csvPending}
          onClick={() => downloadExport('/api/export/csv', `cashctrl-${date}.csv`, setCsvPending)}
        >
          {csvPending ? '…' : '⬇ Télécharger CSV'}
        </Button>
        <Button
          variant="export"
          disabled={jsonPending}
          onClick={() =>
            downloadExport('/api/export/json', `cashctrl-backup-${date}.json`, setJsonPending)
          }
        >
          {jsonPending ? '…' : '⬇ Télécharger JSON'}
        </Button>
      </div>
    </div>
  );
}
