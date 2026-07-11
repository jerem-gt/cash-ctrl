import type { BackupRunResult } from '@cashctrl/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { backupApi } from '@/api/client';
import { fireAndForget } from '@/lib/async';

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
        fireAndForget(qc.invalidateQueries({ queryKey: ['backup-list'] }));
      }
      fireAndForget(qc.invalidateQueries({ queryKey: ['settings'] }));
    },
  });
}
