import { useActiveSection } from '@/features/dashboard/hooks/useActiveSection';

export interface NavSection {
  id: string;
  label: string;
  badge?: number;
  show: boolean;
}

interface Props {
  sections: NavSection[];
}

export function DashboardNav({ sections }: Readonly<Props>) {
  const visible = sections.filter((s) => s.show);
  const visibleIds = visible.map((s) => s.id);
  const active = useActiveSection(visibleIds);

  if (visible.length < 2) return null;

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 56;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  return (
    <div className="sticky top-0 z-10 -mx-4 md:-mx-9 px-4 md:px-9 py-2 bg-canvas/90 backdrop-blur-sm border-b border-line-subtle">
      <nav className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {visible.map(({ id, label, badge }) => (
          <button
            key={id}
            onClick={() => scrollTo(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors ${
              active === id
                ? 'bg-surface text-content shadow-sm'
                : 'text-content-muted hover:text-content hover:bg-surface-muted'
            }`}
          >
            {label}
            {badge != null && badge > 0 && (
              <span className="flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-brand-500 text-white text-[10px] leading-none">
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
