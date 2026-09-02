import { build } from "esbuild";
import { resolve } from "node:path";

const VIRTUAL_RUNTIME_ID = "virtual:crc-runtime-source";
const RESOLVED_RUNTIME_ID = `\0${VIRTUAL_RUNTIME_ID}`;
const CRC_ENTRY_POINT = /^@crc\/core(?:\/jsx-runtime|\/jsx-dev-runtime)?$/;

function crcEntryPoints(mode: string): ReadonlyMap<string, string> {
  const directory = mode === "built" ? "dist" : "src";
  const extension = mode === "built" ? "mjs" : "ts";
  return new Map([
    [
      "@crc/core",
      resolve(
        import.meta.dirname,
        `../packages/core/${directory}/index.${extension}`,
      ),
    ],
    [
      "@crc/core/jsx-runtime",
      resolve(
        import.meta.dirname,
        `../packages/core/${directory}/jsx-runtime.${extension}`,
      ),
    ],
    [
      "@crc/core/jsx-dev-runtime",
      resolve(
        import.meta.dirname,
        `../packages/core/${directory}/jsx-dev-runtime.${extension}`,
      ),
    ],
  ]);
}

export function crcRuntimeSource(mode: string) {
  return {
    name: "crc-runtime-source",
    resolveId(id: string) {
      return id === VIRTUAL_RUNTIME_ID ? RESOLVED_RUNTIME_ID : undefined;
    },
    async load(id: string) {
      if (id !== RESOLVED_RUNTIME_ID) return undefined;
      const entryPoints = crcEntryPoints(mode);
      const result = await build({
        entryPoints: [
          resolve(import.meta.dirname, "./crc-studio-runtime-entry.ts"),
        ],
        bundle: true,
        define: { "import.meta.env.DEV": "false" },
        format: "iife",
        globalName: "CRC_CORE",
        platform: "browser",
        plugins: [
          {
            name: "crc-studio-runtime-entries",
            setup(build) {
              build.onResolve({ filter: CRC_ENTRY_POINT }, (args) => {
                const path = entryPoints.get(args.path);
                if (!path) return undefined;
                return { path };
              });
            },
          },
        ],
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
