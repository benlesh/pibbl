import { build, type Metafile } from "esbuild";
import { isAbsolute, resolve, sep } from "node:path";

const VIRTUAL_RUNTIME_ID = "virtual:pibbl-runtime-source";
const RESOLVED_RUNTIME_ID = `\0${VIRTUAL_RUNTIME_ID}`;
const PIBBL_ENTRY_POINT =
  /^@pibbl\/(?:core(?:\/(?:filters|internal|jsx-runtime|jsx-dev-runtime|particles|textures|viz|machines(?:\/animation)?|sprites(?:\/formats\/(?:aseprite|texture-packer))?|physics\/2d(?:\/geometry)?))?|three|text)$/;
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
  const directory = mode === "built" ? "dist" : "src";
  const extension = mode === "built" ? "mjs" : "ts";
  return new Map([
    ["@pibbl/core/machines", resolve(import.meta.dirname, `../packages/core/${directory}/features/machines/index.${extension}`)],
    ["@pibbl/core/machines/animation", resolve(import.meta.dirname, `../packages/core/${directory}/features/machines/animation.${extension}`)],
    ["@pibbl/core/sprites", resolve(import.meta.dirname, `../packages/core/${directory}/features/sprites/index.${extension}`)],
    ["@pibbl/core/sprites/formats/aseprite", resolve(import.meta.dirname, `../packages/core/${directory}/features/sprites/formats/aseprite.${extension}`)],
    ["@pibbl/core/sprites/formats/texture-packer", resolve(import.meta.dirname, `../packages/core/${directory}/features/sprites/formats/texture-packer.${extension}`)],

    ["@pibbl/text", resolve(import.meta.dirname, `../packages/text/${directory}/index.${extension}`)],
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
        `../packages/three/${directory}/index.${extension}`,
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
      mode === "built" ? "dist" : "src",
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
  let production = false;
  return {
    name: "pibbl-runtime-source",
    configResolved(config: { isProduction: boolean }) {
      production = config.isProduction;
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
        define: { "import.meta.env.DEV": production ? "false" : "true" },
        format: "esm",
        metafile: true,
        platform: "browser",
        plugins: [
          {
            name: "pibbl-studio-runtime-entries",
            setup(build) {
              build.onResolve({ filter: /engine\.mjs$/ }, args => {
                if (!args.importer.includes('/packages/text/')) return undefined;
                return { path: 'text-engine-loader', namespace: 'pibbl-text' };
              });
              build.onLoad({ filter: /.*/, namespace: 'pibbl-text' }, () => ({ contents: 'export default async function () { const url = new URL("/pibbl-text/engine.mjs", document.baseURI).href; const module = await import(url); return module.default(); }', loader: 'js' }));
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
      const output = result.outputFiles[0]?.text;
      if (!output)
        throw new Error("Pibbl runtime bundling produced no browser output.");
      return `export default ${JSON.stringify(output)};`;
    },
  };
}
