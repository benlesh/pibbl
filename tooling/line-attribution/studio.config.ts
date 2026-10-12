import { defineConfig } from "vite";
import { resolve } from "node:path";
import { lineAttributionPlugin } from "./plugin.mjs";
import base from "../../playground/vite.config";
// Dedicated development fixture: do not make this slice depend on unrelated documentation generation.
export default defineConfig(async (env) => {
  if (env.command !== "serve" || env.mode !== "inspection")
    throw new Error(
      "Line attribution requires an explicit inspection development server.",
    );
  const config = typeof base === "function" ? await base(env) : await base;
  config.plugins = config.plugins?.filter(
    (plugin) =>
      !plugin || !("name" in plugin) || plugin.name !== "pibbl-studio-docs",
  );
  config.plugins?.push(
    lineAttributionPlugin(resolve(import.meta.dirname, "../..")),
  );
  return {
    ...config,
    optimizeDeps: { noDiscovery: true, include: [] },
    root: resolve(import.meta.dirname, "../../playground"),
  };
});
