import { PasswordChangeCard } from '@/components/PasswordChangeCard.tsx';

export function SecuritySettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-serif tracking-tight">Sécurité</h1>
        <p className="text-sm text-black/40">Paramètres de sécurité</p>
      </div>
      <PasswordChangeCard />
    </div>
  );
}
