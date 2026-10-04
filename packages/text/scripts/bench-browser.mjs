import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { chromium } from "playwright";
const assets = new Map();
async function add(directory, prefix) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory())
      await add(
        new URL(`${entry.name}/`, directory),
        `${prefix}${entry.name}/`,
      );
    else if (/\.(m?js|wasm)$/.test(entry.name))
      assets.set(
        `${prefix}${entry.name}`,
        await readFile(new URL(entry.name, directory)),
      );
  }
}
await add(new URL("../dist/", import.meta.url), "/text/");
await add(new URL("../../core/dist/", import.meta.url), "/core/");
assets.set(
  "/fixture.ttf",
  await readFile(
    new URL("../test/fixtures/ABeeZee-Regular.ttf", import.meta.url),
  ),
);
const html =
  '<!doctype html><script type="importmap">{"imports":{"@crc/core":"/core/index.mjs"}}</script>';
const server = createServer((request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  const data = path === "/" ? html : assets.get(path);
  response.writeHead(data === undefined ? 404 : 200, {
    "Content-Type": path.endsWith(".wasm")
      ? "application/wasm"
      : /\.m?js$/.test(path)
        ? "text/javascript"
        : path === "/"
          ? "text/html"
          : "application/octet-stream",
  });
  response.end(data);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const requests = [],
    errors = [];
  page.on("request", (request) =>
    requests.push(new URL(request.url()).pathname),
  );
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(() => import("/text/index.mjs"));
  if (requests.some((path) => /engine\.(mjs|wasm)$/.test(path)))
    throw new Error("Importing text eagerly loads its engine.");
  const result = await page.evaluate(async () => {
    const { loadOutlineFont, createTextGeometry } =
      await import("/text/index.mjs");
    const { profileTextGeometry } = await import("/text/testing.mjs");
    const start = performance.now();
    const font = await loadOutlineFont("/fixture.ttf");
    const coldLoadMs = performance.now() - start;
    const scenarios = [];
    try {
      for (const [name, text, iterations] of [
        ["single glyph", "A", 100],
        ["short label", "Hello CRC", 100],
        ["long repeated", "Hello CRC ".repeat(100), 25],
        [
          "long varied",
          "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 ".repeat(
            20,
          ),
          25,
        ],
        ["very long", "Hello CRC ".repeat(1000), 8],
      ]) {
        const samples = [];
        let glyphs = 0,
          segments = 0;
        const batchSize = text.length < 100 ? 20 : 1;
        for (let i = 0; i < iterations + 3; i++) {
          const start = performance.now();
          let value;
          for (let batch = 0; batch < batchSize; batch++)
            value = createTextGeometry(font, text, { fontSize: 100 });
          const duration = (performance.now() - start) / batchSize;
          if (i >= 3) samples.push(duration);
          glyphs = value.glyphs.length;
          segments = value.geometry.segmentCount;
        }
        samples.sort((a, b) => a - b);
        const phases = [];
        for (let i = 0; i < iterations; i++) {
          const sum = {};
          for (let batch = 0; batch < batchSize; batch++) {
            const { timings } = profileTextGeometry(font, text, {
              fontSize: 100,
            });
            for (const [key, value] of Object.entries(timings))
              sum[key] = (sum[key] ?? 0) + value / batchSize;
          }
          phases.push(sum);
        }
        const phaseMedianMs = Object.fromEntries(
          Object.keys(phases[0]).map((key) => {
            const values = phases
              .map((sample) => sample[key])
              .sort((a, b) => a - b);
            return [key, values[Math.floor(values.length / 2)]];
          }),
        );
        scenarios.push({
          name,
          phaseMedianMs,
          utf16Units: text.length,
          glyphs,
          segments,
          batchSize,
          samples: iterations,
          medianMs: samples[Math.floor(samples.length / 2)],
          p95Ms:
            samples[
              Math.min(samples.length - 1, Math.floor(samples.length * 0.95))
            ],
        });
      }
    } finally {
      font.dispose();
    }
    return { coldLoadMs, scenarios };
  });
  if (errors.length) throw new Error(errors.join("\n"));
  process.stdout.write(
    String(
      JSON.stringify(
        {
          browser: browser.version(),
          platform: `${process.platform}/${process.arch}`,
          lazyEngineVerified: true,
          ...result,
        },
        null,
        2,
      ),
    ) + "\n",
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
