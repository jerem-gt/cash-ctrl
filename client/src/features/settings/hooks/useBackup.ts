import type { BackupRunResult } from '@cashctrl/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { backupApi } from '@/api/client';

export function useBackupList() {
  return useQuery({
    queryKey: ['backup-list'],
    queryFn: backupApi.list,
  });
}

export function useRunBackup() {
  const qc = useQueryClient();
  return useMutation<BackupRunResult>({
    mutationFn: backupApi.run,
    onSuccess: (result) => {
      if (!result.skipped) {
        void qc.invalidateQueries({ queryKey: ['backup-list'] });
      }
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
