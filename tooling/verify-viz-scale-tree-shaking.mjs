import assert from "node:assert/strict";
import { build } from "esbuild";
import { resolve } from "node:path";

/** Prove that selecting one family does not retain another family's implementation. */
export async function verifyScaleTreeShaking(entry) {
  for (const family of ["Linear", "Bar", "UTC", "Log", "Symlog", "Point"]) {
    const { metafile } = await build({
      stdin: { contents: `export { ${family}Scale, use${family}Scale } from ${JSON.stringify(entry)};`, resolveDir: process.cwd() },
      bundle: true, format: "esm", platform: "browser", write: false, metafile: true,
      external: ["@pibbl/core", "@pibbl/core/internal"],
    });
    const retained = Object.values(metafile.outputs).flatMap(output => Object.entries(output.inputs).filter(([, value]) => value.bytesInOutput > 0).map(([path]) => path));
    const modules = retained.join("\n");
    for (const extra of ["Symlog", "Point"]) if (family !== extra) assert.doesNotMatch(modules, new RegExp(`/((?:use-)?${extra.toLowerCase()}-scale)(?:-component)?\\.[jt]s`), `${family} retained ${extra}`);
    if (family !== "Log") assert.doesNotMatch(modules, /\/(?:log-scale|use-log-scale)(?:-component)?\.[jt]s/, `${family} retained logarithmic scales`);
    if (family !== "UTC") assert.doesNotMatch(modules, /\/(?:utc-scale|use-utc-scale)(?:-component)?\.[jt]s/, `${family} retained UTC`);
    if (family !== "Bar") assert.doesNotMatch(modules, /\/(?:bar-scale|band-scale|use-bar-scale)\.[jt]s/, `${family} retained bands`);
    if (family !== "Linear") assert.doesNotMatch(modules, /\/(?:linear-scale-component|use-linear-scale)\.[jt]s/, `${family} retained the linear public API`);
    assert.match(modules, new RegExp(`/use-${family.toLowerCase()}-scale\\.[jt]s`));
  }
}
if (process.argv[1] === import.meta.filename) {
  await verifyScaleTreeShaking(resolve("packages/core/src/features/viz/index.ts"));
  await verifyScaleTreeShaking(resolve("packages/core/dist/features/viz/index.mjs"));
  process.stdout.write("Scale tree shaking: 6 families isolated in source and built bundles.\n");
}
