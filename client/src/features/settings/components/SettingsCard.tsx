import { ChevronDown, Pencil, X } from 'lucide-react';
import { CSSProperties, ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@/components/ui';

interface SettingsCardProps {
  title: string;
  icon: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  leading?: ReactNode;
  canDelete?: boolean;
  onDelete?: () => void;
  isEditing: boolean;
  onEditStart: () => void;
  editContent: ReactNode;
  collapsibleContent?: ReactNode;
  /** Force l'ouverture du contenu repliable (ex. recherche qui matche un enfant). */
  forceExpanded?: boolean;
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
  isEditing,
  onEditStart,
  editContent,
  collapsibleContent,
  forceExpanded = false,
  dragRef,
  dragStyle,
}: Readonly<SettingsCardProps>) {
  const { t } = useTranslation('settings');
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpanded || expanded;

  return (
    <article
      ref={dragRef}
      style={dragStyle}
      aria-label={title}
      className="bg-surface rounded-2xl border border-line-subtle shadow-sm overflow-hidden"
    >
      <div className="p-4 flex flex-col gap-3">
        {isEditing ? (
          <div className="animate-in fade-in zoom-in-95">{editContent}</div>
        ) : (
          <div className="flex items-center gap-2">
            {collapsibleContent ? (
              <button
                aria-label={title}
                aria-expanded={isExpanded}
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left hover:opacity-70 transition-opacity"
              >
                <div className="w-9 h-9 rounded-xl bg-surface-muted flex items-center justify-center text-lg shadow-inner ring-1 ring-line shrink-0 overflow-hidden">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <ChevronDown
                      size={12}
                      className={`text-content-faint transition-transform duration-200 shrink-0 ${isExpanded ? '' : '-rotate-90'}`}
                    />
                    <p className="font-semibold text-sm tracking-tight leading-none">{title}</p>
                  </div>
                  {subtitle !== undefined && <div className="mt-1 ml-[18px]">{subtitle}</div>}
                </div>
              </button>
            ) : (
              <>
                {leading}
                <div className="w-9 h-9 rounded-xl bg-surface-muted flex items-center justify-center text-lg shadow-inner ring-1 ring-line shrink-0 overflow-hidden">
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
              <IconButton label={t('card.edit_label')} size="sm" onClick={onEditStart}>
                <Pencil size={14} strokeWidth={1.5} />
              </IconButton>
              {canDelete && onDelete && (
                <IconButton
                  label={t('card.delete_label')}
                  size="sm"
                  variant="danger"
                  onClick={onDelete}
                >
                  <X size={16} strokeWidth={2} />
                </IconButton>
              )}
            </div>
          </div>
        )}
      </div>
      {collapsibleContent && (
        <div hidden={!isExpanded} className="border-t border-line-subtle p-4 pt-3">
          {collapsibleContent}
        </div>
      )}
    </article>
  );
}
