import assert from "node:assert/strict";
import { build } from "esbuild";
import { resolve } from "node:path";
const entries = new Map([
  ["@pibbl/core", resolve("packages/core/src/index.ts")],
  ["@pibbl/core/internal", resolve("packages/core/src/internal.ts")],
  ["@pibbl/core/viz", resolve("packages/core/src/features/viz/index.ts")],
  [
    "@pibbl/core/viz/inspection",
    resolve("packages/core/src/features/viz/inspection.ts"),
  ],
]);
async function bundle(contents) {
  return build({
    stdin: { contents, resolveDir: process.cwd() },
    bundle: true,
    write: false,
    format: "esm",
    minify: true,
    metafile: true,
    plugins: [
      {
        name: "public-source",
        setup(api) {
          api.onResolve({ filter: /^@pibbl\/core(?:\/.*)?$/ }, (args) =>
            entries.has(args.path)
              ? { path: entries.get(args.path) }
              : undefined,
          );
        },
      },
    ],
  });
}
const rendering = await bundle(
  'export { LineSeries, PointSeries, BarSeries, CandlestickSeries, VolumeSeries, TradingTimeScale } from "@pibbl/core/viz";',
);
assert(
  !Object.keys(rendering.metafile.inputs).some((path) =>
    path.includes("/viz/inspection/"),
  ),
  "Rendering must exclude inspection implementations",
);
const query = await bundle(
  'export { nearestRecordedX } from "@pibbl/core/viz/inspection";',
);
assert(
  !Object.entries(query.metafile.outputs).some(([, output]) =>
    Object.entries(output.inputs).some(
      ([path, value]) =>
        value.bytesInOutput > 0 &&
        /(?:owned-ref|capture\.ts|handler\.ts|painted-point|bar\.ts)/.test(
          path,
        ),
    ),
  ),
  "Nearest-x must exclude capture, handlers and painted lookup",
);
assert(
  !query.outputFiles[0].text.includes("sampleRecordedX"),
  "Nearest-x excludes sampling operation",
);
console.warn(
  `Inspection tree-shaking: rendering excludes inspection modules; nearest-x bundle ${query.outputFiles[0].contents.length} bytes excludes optional capabilities.`,
);
