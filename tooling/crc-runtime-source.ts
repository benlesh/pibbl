import { build } from "esbuild";
import { resolve } from "node:path";

const VIRTUAL_RUNTIME_ID = "virtual:crc-runtime-source";
const RESOLVED_RUNTIME_ID = `\0${VIRTUAL_RUNTIME_ID}`;

export function crcRuntimeSource(mode: string) {
  return {
    name: "crc-runtime-source",
    resolveId(id: string) {
      return id === VIRTUAL_RUNTIME_ID ? RESOLVED_RUNTIME_ID : undefined;
    },
    async load(id: string) {
      if (id !== RESOLVED_RUNTIME_ID) return undefined;
      const entryPoint =
        mode === "built"
          ? resolve(import.meta.dirname, "../packages/core/dist/index.mjs")
          : resolve(import.meta.dirname, "../packages/core/src/index.ts");
      const result = await build({
        entryPoints: [entryPoint],
        bundle: true,
        format: "iife",
        globalName: "CRC_CORE",
        platform: "browser",
        target: "es2022",
        write: false,
      });
      const output = result.outputFiles[0]?.text;
      if (!output)
        throw new Error("CRC runtime bundling produced no browser output.");
      return `export default ${JSON.stringify(output)};`;
    },
  };
}
