import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineBrowserCommand, playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig } from 'vitest/config';
import { assertBuiltCore } from './tooling/assert-built-core.ts';
import { crcRuntimeSource } from './tooling/crc-runtime-source.ts';
import { crcStudioDocs } from './tooling/studio-docs/vite-plugin.ts';

interface DevToolsSession {
  send(method: string, params?: Record<string, unknown>): Promise<any>;
}

interface DevToolsProvider {
  getCDPSession(sessionId: string): Promise<DevToolsSession>;
}

type DevToolsProfileKind = 'allocations' | 'cpu';

const activeDevToolsProfiles = new Map<string, {
  kind: DevToolsProfileKind;
  session: DevToolsSession;
}>();

const startDevToolsProfile = defineBrowserCommand(async ({ provider, sessionId }, kind: DevToolsProfileKind) => {
  if (activeDevToolsProfiles.has(sessionId)) {
    throw new Error(`A DevTools profile is already active for session ${sessionId}.`);
  }
  const session = await (provider as unknown as DevToolsProvider).getCDPSession(sessionId);
  if (kind === 'cpu') {
    await session.send('Profiler.enable');
    await session.send('Profiler.setSamplingInterval', { interval: 100 });
    await session.send('Profiler.start');
  } else {
    await session.send('HeapProfiler.enable');
    await session.send('HeapProfiler.startSampling', {
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true,
      samplingInterval: 16_384,
    });
  }
  activeDevToolsProfiles.set(sessionId, { kind, session });
});

const stopDevToolsProfile = defineBrowserCommand(async ({ sessionId }, outputPath: string) => {
  const active = activeDevToolsProfiles.get(sessionId);
  if (!active) {
    throw new Error(`No DevTools profile is active for session ${sessionId}.`);
  }
  activeDevToolsProfiles.delete(sessionId);
  const { kind, session } = active;
  if (kind === 'cpu') {
    const result = await session.send('Profiler.stop');
    await session.send('Profiler.disable');
    await writeFile(outputPath, JSON.stringify(result.profile));
  } else {
    const result = await session.send('HeapProfiler.stopSampling');
    await session.send('HeapProfiler.disable');
    await writeFile(outputPath, JSON.stringify(result.profile));
  }
  return outputPath;
});

export default defineConfig(({ mode }) => ({
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: '@crc/core',
    },
  },
  plugins: [
    crcRuntimeSource(mode),
    crcStudioDocs({
      repositoryRoot: fileURLToPath(new URL(".", import.meta.url)),
    }),
    ...(mode === "built" ? [assertBuiltCore()] : []),
  ],
  resolve: {
    alias: mode === 'built' ? [] : [
      { find: /^@crc\/viz$/, replacement: fileURLToPath(new URL('./packages/viz/src/index.ts', import.meta.url)) },
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
        find: '@crc/core/types',
        replacement: fileURLToPath(new URL('./packages/core/src/types.ts', import.meta.url)),
      },
      {
        find: /^@crc\/core$/,
        replacement: fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
      },
      {
        find: /^@crc\/three$/,
        replacement: fileURLToPath(new URL('./packages/three/src/index.ts', import.meta.url)),
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
        find: /^@crc\/physics\/3d\/geometry$/,
        replacement: fileURLToPath(new URL('./packages/physics/src/3d-geometry.ts', import.meta.url)),
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
      '.worktrees/**',
      'packages/physics/src/lib/2d/public-types.test.ts',
      'packages/physics/src/lib/3d/public-types.test.ts',
      ...(mode === 'built' ? [] : [
        'packages/webgl/test/internal-entry-identity.test.tsx',
      ]),
    ],
    browser: {
      commands: {
        startDevToolsProfile,
        stopDevToolsProfile,
      },
      enabled: true,
      headless: true,
      viewport: { width: 800, height: 600 },
      instances: [{ browser: "chromium" }],
      provider: playwright({
        launchOptions: {
          args: ["--force-color-profile=srgb", "--font-render-hinting=none"],
        },
        contextOptions: {
          deviceScaleFactor: 1,
          colorScheme: "light",
          reducedMotion: "reduce",
          locale: "en-US",
          timezoneId: "UTC",
        },
      }),
    },
  },
}));
