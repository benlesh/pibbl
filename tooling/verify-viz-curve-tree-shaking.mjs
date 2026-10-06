import assert from "node:assert/strict";
import { build } from "esbuild";
import { resolve } from "node:path";

/** Verify plain marks and each selected curve exclude unused algorithms. */
export async function verifyCurveTreeShaking(entry) {
  for (const selected of [
    "LineSeries",
    "AreaSeries",
    "IntervalBandSeries",
    "stepBefore",
    "stepAfter",
    "stepMidpoint",
    "monotoneX",
  ]) {
    const { outputFiles } = await build({
      stdin: {
        contents: `export { ${selected} } from ${JSON.stringify(entry)};`,
        resolveDir: process.cwd(),
      },
      bundle: true,
      format: "esm",
      platform: "browser",
      write: false,
      external: ["@pibbl/core", "@pibbl/core/internal"],
    });
    const code = outputFiles[0].text;
    for (const algorithm of [
      "stepBefore",
      "stepAfter",
      "stepMidpoint",
      "monotoneX",
    ]) {
      if (selected === algorithm)
        assert.match(
          code,
          new RegExp(
            `function ${algorithm === "monotoneX" ? "monotone" : algorithm}Segments`,
          ),
        );
      else
        assert.doesNotMatch(
          code,
          new RegExp(
            `function ${algorithm === "monotoneX" ? "monotone" : algorithm}Segments`,
          ),
          `${selected} retained ${algorithm}`,
        );
    }
  }
}
/** Each color family stays independently removable. */
export async function verifyColorTreeShaking(entry) {
  for (const selected of [
    "LinearScale",
    "SequentialColorScale",
    "DivergingColorScale",
    "ThresholdColorScale",
  ]) {
    const { outputFiles } = await build({
      stdin: {
        contents: `export { ${selected} } from ${JSON.stringify(entry)};`,
        resolveDir: process.cwd(),
      },
      bundle: true,
      format: "esm",
      platform: "browser",
      write: false,
      external: ["@pibbl/core", "@pibbl/core/internal"],
    });
    const code = outputFiles[0].text;
    for (const family of [
      "SequentialColorScale",
      "DivergingColorScale",
      "ThresholdColorScale",
    ]) {
      if (selected === family)
        assert.match(code, new RegExp(`function ${family}\\(`));
      else
        assert.doesNotMatch(
          code,
          new RegExp(`function ${family}\\(`),
          `${selected} retained ${family}`,
        );
    }
  }
}

if (process.argv[1] === import.meta.filename) {
  await verifyColorTreeShaking(
    resolve("packages/core/src/features/viz/index.ts"),
  );
  await verifyColorTreeShaking(
    resolve("packages/core/dist/features/viz/index.mjs"),
  );
  await verifyCurveTreeShaking(
    resolve("packages/core/src/features/viz/index.ts"),
  );
  await verifyCurveTreeShaking(
    resolve("packages/core/dist/features/viz/index.mjs"),
  );
  process.stdout.write(
    "Curve tree shaking: plain marks and named strategies isolated in source and built bundles.\n",
  );
}
