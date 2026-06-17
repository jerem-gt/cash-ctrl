export function SectionLabel({ label }: Readonly<{ label: string }>) {
  return (
    <div className="flex items-center gap-3 mt-2">
      <span className="text-[10px] font-medium uppercase tracking-widest text-content-faint whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-line-subtle" />
    </div>
  );
}
