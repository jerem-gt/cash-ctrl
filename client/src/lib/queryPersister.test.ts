import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { shouldPersistQuery } from './queryPersister';

function buildQuery(key: unknown[], data: unknown) {
  const qc = new QueryClient();
  qc.setQueryData(key, data);
  const query = qc.getQueryCache().find({ queryKey: key });
  if (!query) throw new Error('query introuvable');
  return query;
}

describe('shouldPersistQuery', () => {
  it('exclut la query me', () => {
    expect(shouldPersistQuery(buildQuery(['me'], { username: 'a' }))).toBe(false);
  });

  it('persiste les autres queries en succès', () => {
    expect(shouldPersistQuery(buildQuery(['accounts'], []))).toBe(true);
  });
});
