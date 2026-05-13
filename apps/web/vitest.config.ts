import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 120000,
    exclude: ['**/node_modules/**', '**/e2e/**', '**/*.spec.ts'],
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
