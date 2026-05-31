import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const NODE_GLOBS = [
  'src/lib/{account,balance,colors,format,parse,qif-parser,routeChunks,stock,taxCalculator}.test.ts',
  'src/features/dashboard/lib/*.test.ts',
  'src/features/portfolio/lib/*.test.ts',
  'src/features/scheduled/lib/*.test.ts',
  'src/features/transactions/lib/*.test.ts',
  'src/pages/import.helpers.test.ts',
  'src/features/settings/components/import/Shared.test.ts',
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    pool: 'threads',
    isolate: false,
    typecheck: { tsconfig: './tsconfig.test.json' },
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/tests/**',
        'src/types.ts',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 70,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: NODE_GLOBS,
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          setupFiles: ['./src/tests/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: NODE_GLOBS,
        },
      },
    ],
  },
});
