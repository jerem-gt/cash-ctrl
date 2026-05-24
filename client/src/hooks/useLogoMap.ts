import { useMemo } from 'react';

import { useBanks } from './useBanks';

export function useLogoMap(): Record<string, string | null> {
  const { data: banks = [] } = useBanks();
  return useMemo(() => Object.fromEntries(banks.map((b) => [b.name, b.logo])), [banks]);
}
