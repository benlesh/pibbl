import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    tsconfigPaths(),
  ],
  test: {
    browser: {
      enabled: true,
      headless: true,
      name: 'chromium',
      provider: 'playwright',
      providerOptions: {
        launch: {
          devtools: false,
          args: [
            '--force-color-profile=srgb',
            '--font-render-hinting=none',
          ],
        },
        context: {
          viewport: { width: 800, height: 600 },
          deviceScaleFactor: 1,
          colorScheme: 'light',
          reducedMotion: 'reduce',
          locale: 'en-US',
          timezoneId: 'UTC',
        },
      },
    },
  },
});
