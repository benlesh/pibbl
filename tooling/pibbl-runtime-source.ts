import { build, type Metafile } from "esbuild";
import type { ViteDevServer, HmrContext } from "vite";
import { isAbsolute, resolve, sep } from "node:path";

const VIRTUAL_RUNTIME_ID = "virtual:pibbl-runtime-source";
const RESOLVED_RUNTIME_ID = `\0${VIRTUAL_RUNTIME_ID}`;
const PIBBL_ENTRY_POINT =
  /^@pibbl\/(?:core(?:\/(?:sync|filters|internal(?:\/layout)?|jsx-runtime|jsx-dev-runtime|particles|textures|viz(?:\/inspection)?|machines(?:\/animation)?|sprites(?:\/formats\/(?:aseprite|texture-packer))?|physics\/2d(?:\/geometry)?))?|three|text)$/;
const THREE_ENTRY_POINT = /^three(?:\/addons\/controls\/OrbitControls\.js)?$/;

const threeEntryPoints = new Map([
  [
    "three",
    resolve(
      import.meta.dirname,
      "../packages/three/node_modules/three/build/three.module.js",
    ),
  ],
  [
    "three/addons/controls/OrbitControls.js",
    resolve(
      import.meta.dirname,
      "../packages/three/node_modules/three/examples/jsm/controls/OrbitControls.js",
    ),
  ],
]);

function pibblEntryPoints(mode: string): ReadonlyMap<string, string> {
  const directory = mode === "layout-wasm-built" ? ".layout-wasm-package/dist" : mode === "built" ? "dist" : "src";
  const extension = mode === "built" || mode === "layout-wasm-built" ? "mjs" : "ts";
  return new Map([
    ["@pibbl/core/sync", resolve(import.meta.dirname, `../packages/core/${directory}/sync.${extension}`)],
    ["@pibbl/core/viz/inspection", resolve(import.meta.dirname, `../packages/core/${directory}/features/viz/inspection.${extension}`)],
    ["@pibbl/core/machines", resolve(import.meta.dirname, `../packages/core/${directory}/features/machines/index.${extension}`)],
    ["@pibbl/core/machines/animation", resolve(import.meta.dirname, `../packages/core/${directory}/features/machines/animation.${extension}`)],
    ["@pibbl/core/sprites", resolve(import.meta.dirname, `../packages/core/${directory}/features/sprites/index.${extension}`)],
    ["@pibbl/core/sprites/formats/aseprite", resolve(import.meta.dirname, `../packages/core/${directory}/features/sprites/formats/aseprite.${extension}`)],
    ["@pibbl/core/sprites/formats/texture-packer", resolve(import.meta.dirname, `../packages/core/${directory}/features/sprites/formats/texture-packer.${extension}`)],

    ["@pibbl/text", resolve(import.meta.dirname, `../packages/text/${mode === "layout-wasm-built" ? "dist" : directory}/index.${extension}`)],
    ["@pibbl/core/filters", resolve(import.meta.dirname, `../packages/core/${directory}/filters.${extension}`)],
    ["@pibbl/core/textures", resolve(import.meta.dirname, `../packages/core/${directory}/features/textures/index.${extension}`)],
    [
      "@pibbl/core/viz",
      resolve(
        import.meta.dirname,
        `../packages/core/${directory}/features/viz/index.${extension}`,
      ),
    ],
    [
      "@pibbl/core",
      resolve(
        import.meta.dirname,
        `../packages/core/${directory}/index.${extension}`,
      ),
    ],
    [
      "@pibbl/core/jsx-runtime",
      resolve(
        import.meta.dirname,
        `../packages/core/${directory}/jsx-runtime.${extension}`,
      ),
    ],
    [
      "@pibbl/core/jsx-dev-runtime",
      resolve(
        import.meta.dirname,
        `../packages/core/${directory}/jsx-dev-runtime.${extension}`,
      ),
    ],
    [
      "@pibbl/core/internal/layout",
      resolve(
        import.meta.dirname,
        `../packages/core/${directory}/layout-kernel.${extension}`,
      ),
    ],
    [
      "@pibbl/core/internal",
      resolve(
        import.meta.dirname,
        `../packages/core/${directory}/internal.${extension}`,
      ),
    ],
    [
      "@pibbl/core/particles",
      resolve(
        import.meta.dirname,
        `../packages/core/${directory}/features/particles/index.${extension}`,
      ),
    ],
    [
      "@pibbl/three",
      resolve(
        import.meta.dirname,
        `../packages/three/${mode === "layout-wasm-built" ? "dist" : directory}/index.${extension}`,
      ),
    ],
    [
      "@pibbl/core/physics/2d",
      resolve(
        import.meta.dirname,
        `../packages/core/${directory}/features/physics/2d.${extension}`,
      ),
    ],
    [
      "@pibbl/core/physics/2d/geometry",
      resolve(
        import.meta.dirname,
        `../packages/core/${directory}/features/physics/2d-geometry.${extension}`,
      ),
    ],
  ]);
}

function assertSingleRuntimeMode(
  metafile: Metafile,
  mode: string,
  repositoryRoot: string,
): void {
  const inputs = Object.keys(metafile.inputs).map((path) =>
    isAbsolute(path) ? path : resolve(repositoryRoot, path),
  );
  for (const packageName of ["core", "three", "text"]) {
    const packageRoot = resolve(repositoryRoot, `packages/${packageName}`);
    const expectedRoot = resolve(
      packageRoot,
      mode === "layout-wasm-built" ? (packageName === "core" ? ".layout-wasm-package/dist" : "dist") : mode === "built" ? "dist" : "src",
    );
    const packageNodeModules = resolve(packageRoot, "node_modules");
    const packageInputs = inputs.filter(
      (path) =>
        (path === packageRoot || path.startsWith(`${packageRoot}${sep}`)) &&
        path !== packageNodeModules &&
        !path.startsWith(`${packageNodeModules}${sep}`),
    );
    if (
      packageInputs.length === 0 ||
      packageInputs.some(
        (path) =>
          path !== expectedRoot && !path.startsWith(`${expectedRoot}${sep}`),
      ) ||
      inputs.some((path) =>
        path.includes(`${sep}node_modules${sep}@pibbl${sep}${packageName}${sep}`),
      )
    ) {
      throw new Error(
        `Pibbl Studio ${mode} runtime must bundle @pibbl/${packageName} once from ${expectedRoot}.`,
      );
    }
  }
}

export function pibblRuntimeSource(mode: string) {
  const entryPoints = pibblEntryPoints(mode);
  const runtimeInputs = new Set<string>();
  let server: ViteDevServer | undefined;
  let production = false;
  let base = "/";
  return {
    name: "pibbl-runtime-source",
    enforce: "pre" as const,
    configResolved(config: { isProduction: boolean; base: string }) {
      production = config.isProduction;
      base = config.base;
    },
    configureServer(value: ViteDevServer) {
      server = value;
      server.watcher.add([...runtimeInputs]);
    },
    handleHotUpdate(context: HmrContext) {
      if (!runtimeInputs.has(resolve(context.file))) return undefined;
      const module = context.server.moduleGraph.getModuleById(RESOLVED_RUNTIME_ID);
      if (!module) return undefined;
      context.server.moduleGraph.invalidateModule(module);
      return [module];
    },
    resolveId(id: string) {
      if (id === VIRTUAL_RUNTIME_ID) return RESOLVED_RUNTIME_ID;
      return entryPoints.get(id);
    },
    async load(id: string) {
      if (id !== RESOLVED_RUNTIME_ID) return undefined;
      const repositoryRoot = resolve(import.meta.dirname, "..");
      const result = await build({
        absWorkingDir: repositoryRoot,
        stdin: {
          contents:
            'import * as runtime from "./tooling/pibbl-studio-runtime-entry.ts"; globalThis["PIBBL_CORE"] = runtime;',
          resolveDir: repositoryRoot,
          loader: "ts",
        },
        bundle: true,
        define: { __PIBBL_LAYOUT_ASSET_URL__: JSON.stringify(`${base.endsWith("/") ? base : `${base}/`}pibbl-layout/layout.wasm`), "import.meta.env.DEV": production ? "false" : "true", "import.meta.env": JSON.stringify({ MODE: mode, DEV: !production }) },
        format: "esm",
        minifySyntax: true,
        metafile: true,
        platform: "browser",
        plugins: [
          {
            name: "pibbl-studio-runtime-entries",
            setup(build) {
              build.onResolve({ filter: /engine\.mjs$/ }, (args) => {
                if (!args.importer.includes("/packages/text/"))
                  return undefined;
                return { path: "text-engine-loader", namespace: "pibbl-text" };
              });
              build.onLoad({ filter: /.*/, namespace: "pibbl-text" }, () => ({
                contents: `export default async function () {
  const loaderUrl = new URL("/pibbl-text/engine.mjs", document.baseURI);
  const wasmUrl = new URL("/pibbl-text/engine.wasm", document.baseURI);
  const [loader, wasm] = await Promise.all([fetch(loaderUrl), fetch(wasmUrl)]);
  if (!loader.ok || !wasm.ok) throw new Error("Text engine download failed.");
  const source = await loader.text();
  const wasmBinary = await wasm.arrayBuffer();
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    const module = await import(moduleUrl);
    return await module.default({ wasmBinary, locateFile: () => wasmUrl.href });
  } finally { URL.revokeObjectURL(moduleUrl); }
}`,
                loader: "js",
              }));
              build.onResolve({ filter: PIBBL_ENTRY_POINT }, (args) => {
                const path = entryPoints.get(args.path);
                if (!path) return undefined;
                return { path };
              });
              build.onResolve({ filter: THREE_ENTRY_POINT }, (args) => {
                const path = threeEntryPoints.get(args.path);
                if (!path) return undefined;
                return { path };
              });
            },
          },
        ],
        target: "es2022",
        write: false,
      });
      assertSingleRuntimeMode(result.metafile, mode, repositoryRoot);
      runtimeInputs.clear();
      for (const input of Object.keys(result.metafile.inputs)) {
        if (input.startsWith("packages/") || input.startsWith("tooling/")) {
          runtimeInputs.add(resolve(repositoryRoot, input));
        }
      }
      server?.watcher.add([...runtimeInputs]);
      const output = result.outputFiles[0]?.text;
      if (!output)
        throw new Error("Pibbl runtime bundling produced no browser output.");
      const provenance = mode === "layout-wasm-built"
        ? `globalThis.__PIBBL_BUILT_LAYOUT_PROOF__ = ${JSON.stringify({
            mode,
            coreInputs: Object.keys(result.metafile.inputs).filter(path => path.includes("packages/core/")),
          })};\n`
        : "";
      return `export default ${JSON.stringify(provenance + output)};`;
    },
  };
}
