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
        className={`block border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${isDragging ? 'border-stone-400 bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}
        onDragOver={(e) => {
          e.preventDefault();
          onDragOver();
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="text-4xl mb-3 text-stone-300">⇪</div>
        <p className="text-sm font-medium text-stone-600 mb-1">{t('import.upload_label')}</p>
        <p className="text-xs text-stone-400">{t('import.upload_hint')}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".qif,.xhb,.json"
          className="sr-only"
          aria-label={t('import.file_input_label')}
          onChange={(e) => {
            if (e.target.files?.[0]) onFile(e.target.files[0]);
          }}
        />
      </label>
      {parseError && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {parseError}
        </p>
      )}
    </Card>
  );
}
