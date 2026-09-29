import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@crc\/core\/internal$/,
        replacement: fileURLToPath(
          new URL("../packages/core/src/internal.ts", import.meta.url),
        ),
      },
      {
        find: /^@crc\/core\/jsx-runtime$/,
        replacement: fileURLToPath(
          new URL("../packages/core/src/jsx-runtime.ts", import.meta.url),
        ),
      },
      {
        find: /^@crc\/core$/,
        replacement: fileURLToPath(
          new URL("../packages/core/src/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@crc\/particles$/,
        replacement: fileURLToPath(
          new URL("../packages/particles/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
  test: {
    environment: "node",
    include: [
      "tooling/surviving-package-entries.test.ts",
      "packages/physics/src/lib/3d/**/*.test.ts",
      "packages/physics/src/lib/2d/**/*.test.ts",
      "packages/particles/src/lib/**/*.test.ts",
      "packages/particles/src/lib/**/*.test.tsx",
    ],
    browser: {
      enabled: false,
      headless: true,
      instances: [{ browser: "chromium" }],
      provider: playwright(),
    },
  },
});
