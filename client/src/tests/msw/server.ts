import { type SetupServer, setupServer } from 'msw/node';

import { handlers } from './handlers';

// Singleton global : avec isolate: false, vi.resetModules recréerait une instance MSW concurrente.
const g = globalThis as { __mswServer?: SetupServer };
export const server = (g.__mswServer ??= setupServer(...handlers));
