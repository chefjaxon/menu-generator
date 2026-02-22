import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/lib/__tests__/**/*.test.ts'],
    globals: false,
    testTimeout: 10000,
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/__tests__/**',
        'src/lib/test-fixtures/**',
        'src/lib/ingredient-aliases.ts',
        'src/lib/ingredient-categories.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // server-only throws if imported outside Next.js server context.
      // In vitest (Node), mock it as an empty module so tests can import
      // server-side modules (e.g. prisma.ts) without errors.
      'server-only': path.resolve(__dirname, 'src/lib/test-fixtures/server-only-mock.ts'),
    },
  },
});
