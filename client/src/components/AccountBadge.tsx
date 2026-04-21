interface Props {
  name: string;
  bank?: string | null;
  logo?: string | null;
  className?: string;
}

export function AccountBadge({ name, bank, logo, className = '' }: Readonly<Props>) {
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${className}`}>
      {logo
        ? <img src={logo} alt="" className="w-4 h-4 object-contain rounded shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />
        : bank && <span className="w-4 h-4 rounded bg-stone-100 inline-block shrink-0" />
      }
      <span className="truncate">{name}</span>
      {bank && <span className="text-stone-400 shrink-0">({bank})</span>}
    </span>
  );
}
