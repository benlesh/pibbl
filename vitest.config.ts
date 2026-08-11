import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@crc/core/types',
        replacement: fileURLToPath(new URL('./packages/core/src/types.ts', import.meta.url)),
      },
      {
        find: '@crc/core',
        replacement: fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      },
      {
        find: '@crc/types',
        replacement: fileURLToPath(new URL('./packages/types/src/index.ts', import.meta.url)),
      },
    ],
  },
  test: {
    browser: {
      enabled: true,
      headless: true,
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
          viewport: { width: 800, height: 600 },
          deviceScaleFactor: 1,
          colorScheme: 'light',
          reducedMotion: 'reduce',
          locale: 'en-US',
          timezoneId: 'UTC',
        },
      }),
    },
  },
});
