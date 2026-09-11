import { build, type Metafile } from "esbuild";
import { isAbsolute, resolve, sep } from "node:path";

const VIRTUAL_RUNTIME_ID = "virtual:crc-runtime-source";
const RESOLVED_RUNTIME_ID = `\0${VIRTUAL_RUNTIME_ID}`;
const CRC_ENTRY_POINT =
  /^@crc\/(?:core(?:\/internal|\/jsx-runtime|\/jsx-dev-runtime)?|webgl)$/;

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
    [
      "@crc/core/internal",
      resolve(
        import.meta.dirname,
        `../packages/core/${directory}/internal.${extension}`,
      ),
    ],
    [
      "@crc/webgl",
      resolve(
        import.meta.dirname,
        `../packages/webgl/${directory}/index.${extension}`,
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
  for (const packageName of ["core", "webgl"]) {
    const packageRoot = resolve(repositoryRoot, `packages/${packageName}`);
    const expectedRoot = resolve(
      packageRoot,
      mode === "built" ? "dist" : "src",
    );
    const packageInputs = inputs.filter(
      (path) =>
        path === packageRoot || path.startsWith(`${packageRoot}${sep}`),
    );
    if (
      packageInputs.length === 0 ||
      packageInputs.some(
        (path) =>
          path !== expectedRoot && !path.startsWith(`${expectedRoot}${sep}`),
      ) ||
      inputs.some((path) =>
        path.includes(
          `${sep}node_modules${sep}@crc${sep}${packageName}${sep}`,
        ),
      )
    ) {
      throw new Error(
        `CRC Studio ${mode} runtime must bundle @crc/${packageName} once from ${expectedRoot}.`,
      );
    }
  }
}

export function crcRuntimeSource(mode: string) {
  return {
    name: "crc-runtime-source",
    resolveId(id: string) {
      return id === VIRTUAL_RUNTIME_ID ? RESOLVED_RUNTIME_ID : undefined;
    },
    async load(id: string) {
      if (id !== RESOLVED_RUNTIME_ID) return undefined;
      const repositoryRoot = resolve(import.meta.dirname, "..");
      const entryPoints = crcEntryPoints(mode);
      const result = await build({
        absWorkingDir: repositoryRoot,
        entryPoints: [
          resolve(import.meta.dirname, "./crc-studio-runtime-entry.ts"),
        ],
        bundle: true,
        define: { "import.meta.env.DEV": "false" },
        format: "iife",
        globalName: "CRC_CORE",
        metafile: true,
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
      assertSingleRuntimeMode(result.metafile, mode, repositoryRoot);
      const output = result.outputFiles[0]?.text;
      if (!output)
        throw new Error("CRC runtime bundling produced no browser output.");
      return `export default ${JSON.stringify(output)};`;
    },
  };
}
