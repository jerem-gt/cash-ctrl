import { Card, CardTitle, Button } from '@/components/ui';

export function ExportPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">Export</h2>
        <p className="text-sm text-stone-400 mt-0.5">Téléchargez vos données</p>
      </div>

      <Card>
        <CardTitle>Transactions</CardTitle>
        <p className="text-sm text-stone-500 mb-4">Exportez toutes vos transactions dans le format de votre choix.</p>
        <div className="flex gap-3 flex-wrap">
          <a href="/api/export/csv" download>
            <Button variant="export">⬇ Télécharger CSV</Button>
          </a>
          <a href="/api/export/json" download>
            <Button variant="export">⬇ Télécharger JSON</Button>
          </a>
        </div>
      </Card>
    </div>
  );
}
