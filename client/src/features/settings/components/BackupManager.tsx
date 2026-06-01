import { Download, HardDrive, Play } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { showToast } from '@/components/ui';
import { useBackupList, useRunBackup } from '@/features/settings/hooks/useBackup';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { currentLocale } from '@/lib/format';
import type { BackupFile } from '@/types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function BackupRow({ file }: Readonly<{ file: BackupFile }>) {
  const { t } = useTranslation('settings');
  const date = new Date(file.created_at).toLocaleString(currentLocale(), {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-black/3 transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <HardDrive className="w-4 h-4 text-stone-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-800 truncate">{file.filename}</p>
          <p className="text-[11px] text-stone-400">
            {date} · {formatBytes(file.size)}
          </p>
        </div>
      </div>
      <a
        href={`/api/backup/${encodeURIComponent(file.filename)}`}
        download={file.filename}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-stone-500 hover:text-black bg-stone-50 hover:bg-stone-100 rounded-xl transition-all shrink-0 ml-4"
      >
        <Download className="w-3.5 h-3.5" />
        {t('backup.download')}
      </a>
    </div>
  );
}

export function BackupManager() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: backups = [], isLoading: backupsLoading } = useBackupList();
  const updateSettings = useUpdateSettings();
  const runBackup = useRunBackup();

  const [form, setForm] = useState<{
    backup_enabled: boolean;
    backup_frequency_h: number;
    backup_max_files: number;
  } | null>(null);

  const current = form ?? {
    backup_enabled: settings?.backup_enabled ?? false,
    backup_frequency_h: settings?.backup_frequency_h ?? 24,
    backup_max_files: settings?.backup_max_files ?? 7,
  };

  if (settingsLoading) return <div>{tc('loading')}</div>;

  const handleSave = async () => {
    if (!settings) return;
    try {
      await updateSettings.mutateAsync({
        ...settings,
        ...current,
      });
      setForm(null);
      showToast(t('backup.success_settings'));
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  const handleRunBackup = () => {
    runBackup.mutate(undefined, {
      onSuccess: (result) =>
        result.skipped
          ? showToast(t('backup.no_changes'))
          : showToast(t('backup.created', { filename: result.filename })),
      onError: (err) => showToast(err.message),
    });
  };

  const isDirty = form !== null;

  let backupContent: ReactNode;
  if (backupsLoading) {
    backupContent = <p className="text-sm text-stone-400">{tc('loading')}</p>;
  } else if (backups.length === 0) {
    backupContent = <p className="text-sm text-stone-400 italic">{t('backup.no_backups')}</p>;
  } else {
    backupContent = (
      <div className="flex flex-col">
        {backups.toReversed().map((file) => (
          <BackupRow key={file.filename} file={file} />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      {/* Configuration */}
      <div className="bg-white rounded-4xl p-8 shadow-sm border border-black/5">
        <h2 className="text-lg font-extrabold tracking-tight text-stone-900 mb-6">
          {t('backup.config_title')}
        </h2>

        <div className="flex flex-col gap-5">
          {/* Activation */}
          <div className="flex items-center justify-between gap-4 cursor-pointer">
            <span id="backup-enabled-label" className="text-sm font-medium text-stone-700">
              {t('backup.enable_label')}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={current.backup_enabled}
              aria-labelledby="backup-enabled-label"
              onClick={() =>
                setForm((f) => ({ ...current, ...f, backup_enabled: !current.backup_enabled }))
              }
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                current.backup_enabled ? 'bg-brand-600' : 'bg-stone-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                  current.backup_enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Fréquence */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium text-stone-700" htmlFor="backup-freq">
              {t('backup.freq_label')}
            </label>
            <input
              id="backup-freq"
              type="number"
              min={1}
              max={8760}
              value={current.backup_frequency_h}
              onChange={(e) =>
                setForm((f) => ({
                  ...current,
                  ...f,
                  backup_frequency_h: Number.parseInt(e.target.value) || 24,
                }))
              }
              className="w-24 text-sm text-right bg-stone-50 border border-black/10 focus:border-black outline-none rounded-lg px-3 py-1.5 transition-colors"
            />
          </div>

          {/* Fichiers max */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm font-medium text-stone-700" htmlFor="backup-max">
              {t('backup.max_files_label')}
            </label>
            <input
              id="backup-max"
              type="number"
              min={1}
              max={100}
              value={current.backup_max_files}
              onChange={(e) =>
                setForm((f) => ({
                  ...current,
                  ...f,
                  backup_max_files: Number.parseInt(e.target.value) || 7,
                }))
              }
              className="w-24 text-sm text-right bg-stone-50 border border-black/10 focus:border-black outline-none rounded-lg px-3 py-1.5 transition-colors"
            />
          </div>

          {/* Dernier backup */}
          {settings?.backup_last_at && (
            <p className="text-[11px] text-stone-400">
              {t('backup.last_backup')}{' '}
              {new Date(settings.backup_last_at).toLocaleString(currentLocale(), {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-black/5">
            <button
              type="button"
              onClick={handleRunBackup}
              disabled={runBackup.isPending}
              className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold text-stone-600 hover:text-black bg-stone-50 hover:bg-stone-100 rounded-xl transition-all disabled:opacity-30"
            >
              <Play className="w-3.5 h-3.5" />
              {runBackup.isPending ? t('backup.running') : t('backup.run_now')}
            </button>

            {isDirty && (
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={updateSettings.isPending}
                className="px-4 py-2 text-[11px] font-black text-green-600 hover:bg-green-50 rounded-xl uppercase tracking-wider transition-all disabled:opacity-30"
              >
                {updateSettings.isPending ? tc('loading') : tc('save')}
              </button>
            )}

            {isDirty && (
              <button
                type="button"
                onClick={() => setForm(null)}
                className="px-4 py-2 text-[11px] font-black text-stone-300 hover:bg-stone-100 rounded-xl uppercase tracking-wider transition-all"
              >
                {tc('cancel')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Liste des backups */}
      <div className="bg-white rounded-4xl p-8 shadow-sm border border-black/5">
        <h2 className="text-lg font-extrabold tracking-tight text-stone-900 mb-4">
          {t('backup.files_title')}
        </h2>

        {backupContent}
      </div>
    </div>
  );
}
