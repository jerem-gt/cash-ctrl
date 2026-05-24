import { ChevronDown } from 'lucide-react';
import { CSSProperties, ReactNode, useState } from 'react';

import { IconButton } from '@/components/ui';

interface SettingsCardProps {
  title: string;
  icon: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  leading?: ReactNode;
  canDelete?: boolean;
  onDelete?: () => void;
  editContent: (close: () => void) => ReactNode;
  collapsibleContent?: ReactNode;
  dragRef?: (el: HTMLElement | null) => void;
  dragStyle?: CSSProperties;
}

export function SettingsCard({
  title,
  icon,
  subtitle,
  badge,
  leading,
  canDelete = true,
  onDelete,
  editContent,
  collapsibleContent,
  dragRef,
  dragStyle,
}: Readonly<SettingsCardProps>) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const close = () => setEditing(false);

  return (
    <div
      ref={dragRef}
      style={dragStyle}
      role="article"
      aria-label={title}
      className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden"
    >
      <div className="p-4 flex flex-col gap-3">
        {editing ? (
          <div className="animate-in fade-in zoom-in-95">{editContent(close)}</div>
        ) : (
          <div className="flex items-center gap-2">
            {collapsibleContent ? (
              <button
                aria-label={title}
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left hover:opacity-70 transition-opacity"
              >
                <div className="w-9 h-9 rounded-xl bg-stone-50 flex items-center justify-center text-lg shadow-inner ring-1 ring-black/5 shrink-0 overflow-hidden">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <ChevronDown
                      size={12}
                      className={`text-stone-300 transition-transform duration-200 shrink-0 ${expanded ? '' : '-rotate-90'}`}
                    />
                    <p className="font-semibold text-sm tracking-tight leading-none">{title}</p>
                  </div>
                  {subtitle !== undefined && <div className="mt-1 ml-[18px]">{subtitle}</div>}
                </div>
              </button>
            ) : (
              <>
                {leading}
                <div className="w-9 h-9 rounded-xl bg-stone-50 flex items-center justify-center text-lg shadow-inner ring-1 ring-black/5 shrink-0 overflow-hidden">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm tracking-tight leading-none">{title}</p>
                  {subtitle !== undefined && <div className="mt-1">{subtitle}</div>}
                </div>
              </>
            )}
            {badge}
            <div className="flex items-center gap-0.5 shrink-0">
              <IconButton label="Modifier" size="sm" onClick={() => setEditing(true)}>
                <span aria-hidden="true" className="text-[12px]">
                  ✎
                </span>
              </IconButton>
              {canDelete && onDelete && (
                <IconButton label="Supprimer" size="sm" variant="danger" onClick={onDelete}>
                  <span aria-hidden="true" className="text-lg leading-none">
                    ×
                  </span>
                </IconButton>
              )}
            </div>
          </div>
        )}
      </div>
      {collapsibleContent && (
        <div hidden={!expanded} className="border-t border-black/5 p-4 pt-3">
          {collapsibleContent}
        </div>
      )}
    </div>
  );
}
