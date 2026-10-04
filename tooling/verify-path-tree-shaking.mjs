import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";

const helpers = [
  "flattenPath",
  "flattenPathWang",
  "simplifyPath",
  "simplifyPathRadial",
  "subdividePath",
];

/** Bundle one retained public helper at a time, including from the installed tarball. */
export async function verifyPathTreeShaking(entry, label) {
  for (const selected of ["PathGeometry", ...helpers]) {
    const result = await build({
      stdin: {
        contents: `import { ${[...new Set([selected, "PathGeometry"])].join(", ")} } from ${JSON.stringify(entry)}; globalThis.selectedPathExport = ${selected}; globalThis.Geometry = PathGeometry;`,
        resolveDir: resolve(import.meta.dirname, ".."),
      },
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
      treeShaking: true,
      minify: true,
      define: { "import.meta": "{}" },
      // Preserved names let us inspect retained implementations after minification.
      keepNames: true,
      metafile: true,
    });
    const code = result.outputFiles[0].text;
    const retained = new Set([selected]);
    // Radial intentionally reuses the default DP implementation after filtering.
    if (selected === "simplifyPathRadial") retained.add("simplifyPath");
    for (const candidate of helpers) {
      const name = JSON.stringify(candidate);
      assert.equal(
        code.includes(name),
        retained.has(candidate),
        `${label}/${selected}: unexpected retention of ${candidate}`,
      );
    }
    const context = {};
    runInNewContext(code, context);
    assert.equal(
      typeof context.selectedPathExport,
      "function",
      `${label}/${selected}: bundle does not execute`,
    );
    // Ensure the tree-shaken export still performs real work; constructors and
    // geometry-only helpers must not initialize a DOM renderer on import.
    if (selected === "PathGeometry") {
      const geometry = new context.selectedPathExport();
      geometry.moveTo(0, 0);
      geometry.lineTo(1, 1);
      assert.equal(geometry.segmentCount, 2);
    }
    if (selected !== "PathGeometry") {
      const input = new context.Geometry();
      input.moveTo(0, 0);
      input.lineTo(5, 0.01);
      input.lineTo(10, 0);
      const revision = input.revision;
      const output = context.selectedPathExport(input, {
        tolerance: 0.5,
        divisions: 2,
      });
      assert.notEqual(output, input);
      assert.equal(input.revision, revision);
      assert.equal(
        output.segmentCount,
        selected.startsWith("simplify")
          ? 2
          : selected === "subdividePath"
            ? 5
            : 3,
      );
    }
    process.stdout.write(
      `${label}/${selected}: ${Buffer.byteLength(code)} bytes; other algorithms omitted\n`,
    );
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  await verifyPathTreeShaking(
    resolve(root, "packages/core/src/index.ts"),
    "source",
  );
  await verifyPathTreeShaking(
    resolve(root, "packages/core/dist/index.mjs"),
    "built",
  );
}
