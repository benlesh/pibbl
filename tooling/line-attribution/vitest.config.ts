import { defineConfig, mergeConfig } from "vitest/config";
import { lineAttributionPlugin } from "./plugin.mjs";
import { resolve } from "node:path";
import base from "../../vitest.config";
export default defineConfig(async (env) => {
  const config = typeof base === "function" ? await base(env) : await base;
  config.plugins = config.plugins?.filter(
    (plugin) =>
      !plugin || !("name" in plugin) || plugin.name !== "pibbl-studio-docs",
  );
  return mergeConfig(config, {
    plugins: [
      {
        ...lineAttributionPlugin(resolve(import.meta.dirname, "../..")),
        apply: undefined,
      },
    ],
    test: { include: ["tooling/line-attribution/line-attribution.check.tsx"] },
  });
});
