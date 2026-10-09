import PibblActionsReporter from "./tooling/vitest-actions-reporter.mjs";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineBrowserCommand, playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";
import { assertBuiltCore } from "./tooling/assert-built-core.ts";
import { pibblRuntimeSource } from "./tooling/pibbl-runtime-source.ts";
import { pibblStudioDocs } from "./tooling/studio-docs/vite-plugin.ts";
import { manipulationPointer } from "./tooling/manipulation-browser-command.ts";

interface DevToolsSession {
  send(method: string, params?: Record<string, unknown>): Promise<any>;
}

interface DevToolsProvider {
  getCDPSession(sessionId: string): Promise<DevToolsSession>;
}

type DevToolsProfileKind = "allocations" | "cpu";

const activeDevToolsProfiles = new Map<
  string,
  {
    kind: DevToolsProfileKind;
    session: DevToolsSession;
  }
>();

const startDevToolsProfile = defineBrowserCommand(
  async ({ provider, sessionId }, kind: DevToolsProfileKind) => {
    if (activeDevToolsProfiles.has(sessionId)) {
      throw new Error(
        `A DevTools profile is already active for session ${sessionId}.`,
      );
    }
    const session = await (
      provider as unknown as DevToolsProvider
    ).getCDPSession(sessionId);
    if (kind === "cpu") {
      await session.send("Profiler.enable");
      await session.send("Profiler.setSamplingInterval", { interval: 100 });
      await session.send("Profiler.start");
    } else {
      await session.send("HeapProfiler.enable");
      await session.send("HeapProfiler.startSampling", {
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
        samplingInterval: 16_384,
      });
    }
    activeDevToolsProfiles.set(sessionId, { kind, session });
  },
);

const stopDevToolsProfile = defineBrowserCommand(
  async ({ sessionId }, outputPath: string) => {
    const active = activeDevToolsProfiles.get(sessionId);
    if (!active) {
      throw new Error(
        `No DevTools profile is active for session ${sessionId}.`,
      );
    }
    activeDevToolsProfiles.delete(sessionId);
    const { kind, session } = active;
    if (kind === "cpu") {
      const result = await session.send("Profiler.stop");
      await session.send("Profiler.disable");
      await writeFile(outputPath, JSON.stringify(result.profile));
    } else {
      const result = await session.send("HeapProfiler.stopSampling");
      await session.send("HeapProfiler.disable");
      await writeFile(outputPath, JSON.stringify(result.profile));
    }
    return outputPath;
  },
);

export default defineConfig(({ mode }) => ({
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "@pibbl/core",
    },
  },
  plugins: [
    pibblRuntimeSource(mode),
    pibblStudioDocs({
      repositoryRoot: fileURLToPath(new URL(".", import.meta.url)),
    }),
    ...(mode === "built" ? [assertBuiltCore()] : []),
  ],
  resolve: {
    alias:
      mode === "built"
        ? []
        : [
            { find: /^@pibbl\/core\/filters$/, replacement: fileURLToPath(new URL("./packages/core/src/filters.ts", import.meta.url)) },
            { find: /^@pibbl\/core\/machines\/animation$/, replacement: fileURLToPath(new URL("./packages/core/src/features/machines/animation.ts", import.meta.url)) },
            { find: /^@pibbl\/core\/machines$/, replacement: fileURLToPath(new URL("./packages/core/src/features/machines/index.ts", import.meta.url)) },
            { find: /^@pibbl\/core\/sprites$/, replacement: fileURLToPath(new URL("./packages/core/src/features/sprites/index.ts", import.meta.url)) },
            { find: /^@pibbl\/core\/textures$/, replacement: fileURLToPath(new URL("./packages/core/src/features/textures/index.ts", import.meta.url)) },
            {
              find: /^@pibbl\/core\/viz$/,
              replacement: fileURLToPath(
                new URL("./packages/core/src/features/viz/index.ts", import.meta.url),
              ),
            },
            {
              find: /^@pibbl\/core\/internal$/,
              replacement: fileURLToPath(
                new URL("./packages/core/src/internal.ts", import.meta.url),
              ),
            },
            {
              find: /^@pibbl\/core\/jsx-dev-runtime$/,
              replacement: fileURLToPath(
                new URL(
                  "./packages/core/src/jsx-dev-runtime.ts",
                  import.meta.url,
                ),
              ),
            },
            {
              find: /^@pibbl\/core\/jsx-runtime$/,
              replacement: fileURLToPath(
                new URL("./packages/core/src/jsx-runtime.ts", import.meta.url),
              ),
            },
            {
              find: "@pibbl/core/types",
              replacement: fileURLToPath(
                new URL("./packages/core/src/types.ts", import.meta.url),
              ),
            },
            {
              find: /^@pibbl\/core$/,
              replacement: fileURLToPath(
                new URL("./packages/core/src/index.ts", import.meta.url),
              ),
            },
            {
              find: /^@pibbl\/three$/,
              replacement: fileURLToPath(
                new URL("./packages/three/src/index.ts", import.meta.url),
              ),
            },
            {
              find: /^@pibbl\/core\/physics\/2d\/geometry$/,
              replacement: fileURLToPath(
                new URL(
                  "./packages/core/src/features/physics/2d-geometry.ts",
                  import.meta.url,
                ),
              ),
            },
            {
              find: /^@pibbl\/core\/physics\/2d\/testing$/,
              replacement: fileURLToPath(
                new URL(
                  "./packages/core/src/features/physics/2d-testing.ts",
                  import.meta.url,
                ),
              ),
            },
            {
              find: /^@pibbl\/core\/physics\/2d$/,
              replacement: fileURLToPath(
                new URL("./packages/core/src/features/physics/2d.ts", import.meta.url),
              ),
            },
          ],
  },
  test: {
    ...(process.env.GITHUB_ACTIONS === "true"
      ? { reporters: ["default", new PibblActionsReporter()] }
      : {}),
    exclude: [
      ...configDefaults.exclude,
      "packages/text/.cache/**",
      "packages/text/test/**",
      ".pnpm-store/**",
      ".superpowers/**",
      ".worktrees/**",
      "tooling/surviving-package-entries.test.ts",
      // Tooling .mjs suites use node:test and run in their owning trust stages.
      "tooling/**/*.test.mjs",
      // Private brand assets have their own Node-runner verification.
      "output/brand/**",
      "packages/core/src/features/physics/lib/2d/public-types.test.ts",
    ],
    browser: {
      commands: {
        manipulationPointer,
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
