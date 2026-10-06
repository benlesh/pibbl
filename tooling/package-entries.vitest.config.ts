import PibblActionsReporter from "./vitest-actions-reporter.mjs";
import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@pibbl\/core\/internal$/,
        replacement: fileURLToPath(
          new URL("../packages/core/src/internal.ts", import.meta.url),
        ),
      },
      {
        find: /^@pibbl\/core\/jsx-runtime$/,
        replacement: fileURLToPath(
          new URL("../packages/core/src/jsx-runtime.ts", import.meta.url),
        ),
      },
      {
        find: /^@pibbl\/core$/,
        replacement: fileURLToPath(
          new URL("../packages/core/src/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@pibbl\/core\/particles$/,
        replacement: fileURLToPath(
          new URL("../packages/core/src/features/particles/index.ts", import.meta.url),
        ),
      },
    ],
  },
  test: {
    ...(process.env.GITHUB_ACTIONS === "true"
      ? { reporters: ["default", new PibblActionsReporter()] }
      : {}),
    environment: "node",
    include: ["tooling/surviving-package-entries.test.ts"],
    browser: {
      enabled: false,
      headless: true,
      instances: [{ browser: "chromium" }],
      provider: playwright(),
    },
  },
});
