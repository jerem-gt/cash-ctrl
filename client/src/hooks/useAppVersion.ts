import { useQuery } from '@tanstack/react-query';

import { versionApi } from '@/api/client';

export function useAppVersion() {
  const query = useQuery({
    queryKey: ['version'],
    queryFn: versionApi.get,
    // Optionnel : on peut réduire le retry pour que le point passe au rouge plus vite
    retry: 1,
    // On rafraîchit la version de temps en temps pour vérifier que le back est toujours là
    refetchInterval: 30000,
  });

  return {
    version: query.data?.version ?? '...',
    // Si la requête a réussi, on est online
    isOnline: query.isSuccess,
    // L'état de chargement
    isLoading: query.isLoading,
  };
}
