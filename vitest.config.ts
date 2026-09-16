import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';
import { assertBuiltCore } from './tooling/assert-built-core.ts';
import { crcStudioDocs } from './tooling/studio-docs/vite-plugin.ts';

export default defineConfig(({ mode }) => ({
  plugins: [
    crcStudioDocs({
      repositoryRoot: fileURLToPath(new URL('.', import.meta.url)),
    }),
    ...(mode === 'built' ? [assertBuiltCore()] : []),
  ],
  resolve: {
    alias: mode === 'built' ? [] : [
      {
        find: /^@crc\/core\/internal$/,
        replacement: fileURLToPath(new URL('./packages/core/src/internal.ts', import.meta.url)),
      },
      {
        find: /^@crc\/core\/jsx-dev-runtime$/,
        replacement: fileURLToPath(new URL('./packages/core/src/jsx-dev-runtime.ts', import.meta.url)),
      },
      {
        find: /^@crc\/core\/jsx-runtime$/,
        replacement: fileURLToPath(new URL('./packages/core/src/jsx-runtime.ts', import.meta.url)),
      },
      {
        find: /^@crc\/core\/internal$/,
        replacement: fileURLToPath(new URL('./packages/core/src/internal.ts', import.meta.url)),
      },
      {
        find: '@crc/core/types',
        replacement: fileURLToPath(new URL('./packages/core/src/types.ts', import.meta.url)),
      },
      {
        find: /^@crc\/core$/,
        replacement: fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      },
      {
        find: /^@crc\/physics\/2d\/geometry$/,
        replacement: fileURLToPath(new URL('./packages/physics/src/2d-geometry.ts', import.meta.url)),
      },
      {
        find: /^@crc\/physics\/2d$/,
        replacement: fileURLToPath(new URL('./packages/physics/src/2d.ts', import.meta.url)),
      },
      {
        find: /^@crc\/webgl\/internal$/,
        replacement: fileURLToPath(new URL('./packages/webgl/src/internal.ts', import.meta.url)),
      },
      {
        find: /^@crc\/webgl$/,
        replacement: fileURLToPath(new URL('./packages/webgl/src/index.ts', import.meta.url)),
      },
      {
        find: '@crc/types',
        replacement: fileURLToPath(new URL('./packages/types/src/index.ts', import.meta.url)),
      },
    ],
  },
  test: {
    exclude: [
      ...configDefaults.exclude,
      '.pnpm-store/**',
      '.superpowers/**',
      ...(mode === 'built' ? [] : [
        'packages/webgl/test/internal-entry-identity.test.tsx',
      ]),
    ],
    browser: {
      enabled: true,
      headless: true,
      viewport: { width: 800, height: 600 },
      instances: [
        { browser: 'chromium' },
      ],
      provider: playwright({
        launchOptions: {
          args: [
            '--force-color-profile=srgb',
            '--font-render-hinting=none',
          ],
        },
        contextOptions: {
          deviceScaleFactor: 1,
          colorScheme: 'light',
          reducedMotion: 'reduce',
          locale: 'en-US',
          timezoneId: 'UTC',
        },
      }),
    },
  },
}));
