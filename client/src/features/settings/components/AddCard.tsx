import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Bloc d'ajout partagé : reprend la forme des cartes d'éléments existants
 * (SettingsCard) mais différencié par une bordure pointillée et un avatar « + »
 * teal, pour signaler clairement l'action de création.
 */
export function AddCard({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <article className="bg-white rounded-2xl border-2 border-dashed border-brand-200 shadow-sm p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <Plus size={18} strokeWidth={2.5} />
        </div>
        <p className="font-semibold text-sm tracking-tight">{title}</p>
      </div>
      {children}
    </article>
  );
}
