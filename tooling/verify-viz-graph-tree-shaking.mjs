import assert from "node:assert/strict";
import { build } from "esbuild";
import { resolve } from "node:path";
/** Check that selecting one graph calculation does not retain other layout families. */
export async function verifyGraphTreeShaking(entry) {
  const families = {
    dependency: "layoutDependencies",
    force: "layoutForceNetwork",
    tree: "layoutTree",
    matrix: "layoutMatrix",
    sankey: "layoutSankey",
    bipartite: "layoutBipartite",
    treemap: "layoutTreemap",
    neighborhood: "layoutNeighborhood",
    icicle: "layoutIcicle",
    chord: "layoutChords",
  };
  for (const [family, symbol] of Object.entries(families)) {
    const { metafile } = await build({
      stdin: {
        contents: `export { ${symbol} } from ${JSON.stringify(entry)};`,
        resolveDir: process.cwd(),
      },
      bundle: true,
      format: "esm",
      platform: "browser",
      write: false,
      metafile: true,
      external: ["@pibbl/core", "@pibbl/core/internal"],
    });
    const retained = Object.values(metafile.outputs)
      .flatMap((output) =>
        Object.entries(output.inputs)
          .filter(([, value]) => value.bytesInOutput > 0)
          .map(([path]) => path),
      )
      .join("\n");
    for (const other of Object.keys(families))
      if (
        other !== family &&
        !(family === "force" && other === "dependency") &&
        !(family === "icicle" && other === "treemap")
      )
        assert.doesNotMatch(
          retained,
          new RegExp(`/graph/${other}\\.[jtm]`),
          `${symbol} retained ${other}`,
        );
    assert.match(retained, new RegExp(`/graph/${family}\\.[jtm]`));
  }
}
if (process.argv[1] === import.meta.filename) {
  await verifyGraphTreeShaking(
    resolve("packages/core/src/features/viz/index.ts"),
  );
  await verifyGraphTreeShaking(
    resolve("packages/core/dist/features/viz/index.mjs"),
  );
  process.stdout.write(
    "Graph tree shaking: ten layout families checked in source and built bundles.\n",
  );
}
