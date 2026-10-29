import { defineConfig } from "vite";
import { resolve } from "node:path";
import base from "../../playground/vite.config";
import { renderCompletionPlugin } from "./render-completion-plugin.mjs";

export default defineConfig(async (env) => {
  if (env.command !== "serve" || env.mode !== "inspection")
    throw new Error(
      "Render-completion verification requires the inspection development server.",
    );
  const config = typeof base === "function" ? await base(env) : await base;
  config.plugins = config.plugins?.filter(
    (plugin) =>
      !plugin || !("name" in plugin) || plugin.name !== "pibbl-studio-docs",
  );
  config.plugins?.push(
    renderCompletionPlugin(resolve(import.meta.dirname, "../..")),
  );
  return {
    ...config,
    optimizeDeps: { noDiscovery: true, include: [] },
    root: resolve(import.meta.dirname, "../../playground"),
  };
});
