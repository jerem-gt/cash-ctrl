import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui';

interface Props {
  isDragging: boolean;
  parseError: string;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFile: (file: File) => void;
}

export function UploadStep({
  isDragging,
  parseError,
  onDragOver,
  onDragLeave,
  onDrop,
  onFile,
}: Readonly<Props>) {
  const { t } = useTranslation('settings');
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <label
        className={`block border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${isDragging ? 'border-line-strong bg-surface-muted' : 'border-line hover:border-line-strong'}`}
        onDragOver={(e) => {
          e.preventDefault();
          onDragOver();
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="text-4xl mb-3 text-content-faint">⇪</div>
        <p className="text-sm font-medium text-content-secondary mb-1">
          {t('import.upload_label')}
        </p>
        <p className="text-xs text-content-subtle">{t('import.upload_hint')}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".qif,.xhb,.json,.csv"
          className="sr-only"
          aria-label={t('import.file_input_label')}
          onChange={(e) => {
            if (e.target.files?.[0]) onFile(e.target.files[0]);
          }}
        />
      </label>
      {parseError && (
        <p className="mt-4 text-sm text-danger bg-danger-surface border border-danger/30 rounded-lg px-3 py-2">
          {parseError}
        </p>
      )}
    </Card>
  );
}
