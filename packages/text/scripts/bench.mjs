import { performance } from "node:perf_hooks";
import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const start = performance.now();
const { loadOutlineFont, createTextGeometry } =
  await import("../dist/index.mjs");
const { profileTextGeometry } = await import("../dist/testing.mjs");
const font = await loadOutlineFont(
  await readFile(
    new URL("../test/fixtures/ABeeZee-Regular.ttf", import.meta.url),
  ),
);
process.stdout.write(
  String(
    JSON.stringify({
      environment: process.version,
      platform: `${process.platform}/${process.arch}`,
      coldLoadMs: performance.now() - start,
    }),
  ) + "\n",
);
try {
  for (const [name, text, iterations] of [
    ["single glyph", "A", 100],
    ["short label", "Hello Pibbl", 100],
    ["long repeated", "Hello Pibbl ".repeat(100), 25],
    [
      "long varied",
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 ".repeat(
        20,
      ),
      25,
    ],
    ["very long", "Hello Pibbl ".repeat(1000), 8],
  ]) {
    const samples = [];
    let segments = 0,
      glyphs = 0;
    for (let i = 0; i < iterations + 3; i++) {
      const before = performance.now();
      const result = createTextGeometry(font, text, { fontSize: 100 });
      const elapsed = performance.now() - before;
      if (i >= 3) samples.push(elapsed);
      segments = result.geometry.segmentCount;
      glyphs = result.glyphs.length;
    }
    samples.sort((a, b) => a - b);
    process.stdout.write(
      String(
        JSON.stringify({
          name,
          utf16Units: text.length,
          glyphs,
          segments,
          samples: samples.length,
          medianMs: samples[Math.floor(samples.length / 2)],
          p95Ms:
            samples[
              Math.min(samples.length - 1, Math.floor(samples.length * 0.95))
            ],
        }),
      ) + "\n",
    );
    const phases = [];
    for (let i = 0; i < iterations; i++)
      phases.push(profileTextGeometry(font, text, { fontSize: 100 }).timings);
    const phaseMedianMs = Object.fromEntries(
      Object.keys(phases[0]).map((key) => {
        const values = phases
          .map((sample) => sample[key])
          .sort((a, b) => a - b);
        return [key, values[Math.floor(values.length / 2)]];
      }),
    );
    process.stdout.write(
      JSON.stringify({ name, instrumented: true, phaseMedianMs }) + "\n",
    );
  }
} finally {
  font.dispose();
}
const sizes = [];
async function measure(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory())
      await measure(
        new URL(`${entry.name}/`, directory),
        `${prefix}${entry.name}/`,
      );
    else if (/\.(mjs|wasm)$/.test(entry.name)) {
      const bytes = await readFile(new URL(entry.name, directory));
      sizes.push({
        file: prefix + entry.name,
        bytes: bytes.length,
        gzipBytes: gzipSync(bytes).length,
      });
    }
  }
}
await measure(new URL("../dist/", import.meta.url));
for (const size of sizes) process.stdout.write(JSON.stringify(size) + "\n");
const browserAssets = sizes.filter(
  ({ file }) => file !== "engine.mjs" && file !== "testing.mjs",
);
process.stdout.write(
  JSON.stringify({
    browserDistributionUpperBound: true,
    excludesCoreAndFont: true,
    bytes: browserAssets.reduce((n, s) => n + s.bytes, 0),
    separatelyGzippedBytes: browserAssets.reduce((n, s) => n + s.gzipBytes, 0),
  }) + "\n",
);
