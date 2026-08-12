import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";

const workspaceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const update = process.argv.includes("--update");
const origin = "http://127.0.0.1:4174";
const routes = [
  { name: "landing", hash: "#/examples", ready: ".studio-hero-canvas canvas" },
  {
    name: "primitive",
    hash: "#/examples/drawing/rectangle",
    ready: ".studio-preview__frame:not(.studio-preview__frame--candidate)",
  },
  {
    name: "mouse",
    hash: "#/examples/mouse-events/click",
    ready: ".studio-preview__frame:not(.studio-preview__frame--candidate)",
  },
  {
    name: "advanced",
    hash: "#/examples/advanced-interactions/transformed-clipped-layered-targets",
    ready: ".studio-preview__frame:not(.studio-preview__frame--candidate)",
  },
  {
    name: "test-lab",
    hash: "#/testing/baseline-smoke",
    ready: ".scenario-runner canvas",
  },
];

async function waitForServer(process) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (process.exitCode !== null)
      throw new Error(
        `Studio preview server exited with code ${process.exitCode}.`,
      );
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error("Timed out waiting for the studio preview server.");
}

async function pixelDifference(page, expected, actual) {
  return await page.evaluate(
    async ([expectedBase64, actualBase64]) => {
      const decode = async (base64) => {
        const response = await fetch(`data:image/png;base64,${base64}`);
        const bitmap = await createImageBitmap(await response.blob());
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d");
        context.drawImage(bitmap, 0, 0);
        const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
        bitmap.close();
        return { width: image.width, height: image.height, data: image.data };
      };
      const [expectedImage, actualImage] = await Promise.all([
        decode(expectedBase64),
        decode(actualBase64),
      ]);
      if (
        expectedImage.width !== actualImage.width ||
        expectedImage.height !== actualImage.height
      ) {
        return {
          dimensions: `${expectedImage.width}×${expectedImage.height} versus ${actualImage.width}×${actualImage.height}`,
          differentPixels: -1,
        };
      }
      let differentPixels = 0;
      for (let offset = 0; offset < expectedImage.data.length; offset += 4) {
        if (
          expectedImage.data[offset] !== actualImage.data[offset] ||
          expectedImage.data[offset + 1] !== actualImage.data[offset + 1] ||
          expectedImage.data[offset + 2] !== actualImage.data[offset + 2] ||
          expectedImage.data[offset + 3] !== actualImage.data[offset + 3]
        )
          differentPixels++;
      }
      return {
        dimensions: `${expectedImage.width}×${expectedImage.height}`,
        differentPixels,
      };
    },
    [expected.toString("base64"), actual.toString("base64")],
  );
}

const server = spawn(
  process.execPath,
  [
    resolve(workspaceRoot, "node_modules/vite/bin/vite.js"),
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4174",
    "--strictPort",
  ],
  {
    cwd: resolve(workspaceRoot, "playground"),
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk;
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk;
});

let browser;
try {
  await waitForServer(server);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "UTC",
    deviceScaleFactor: 1,
  });
  await mkdir(resolve(workspaceRoot, "test-screenshots/studio"), {
    recursive: true,
  });

  for (const route of routes) {
    await page.goto(`${origin}/${route.hash}`);
    await page.locator(route.ready).waitFor({ timeout: 30_000 });
    if (route.hash.startsWith("#/examples/")) {
      await page
        .getByText("Live · changes run automatically")
        .waitFor({ timeout: 30_000 });
    }
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content:
        ".monaco-editor .cursors-layer { visibility: hidden !important; }",
    });
    await page.evaluate(
      () =>
        new Promise((resolvePromise) =>
          requestAnimationFrame(() => requestAnimationFrame(resolvePromise)),
        ),
    );
    const actual = await page.screenshot({
      fullPage: true,
      animations: "disabled",
    });
    const baselinePath = resolve(
      workspaceRoot,
      `packages/core/test/visual-baselines/studio-${route.name}.expected.png`,
    );
    const actualPath = resolve(
      workspaceRoot,
      `test-screenshots/studio/${route.name}.actual.png`,
    );
    await writeFile(actualPath, actual);
    if (update) {
      await writeFile(baselinePath, actual);
      continue;
    }
    const expected = await readFile(baselinePath).catch(() => undefined);
    if (!expected)
      throw new Error(
        `Missing studio visual baseline ${baselinePath}. Run pnpm test:studio-visual:update and inspect every image.`,
      );
    const comparison = await pixelDifference(page, expected, actual);
    if (comparison.differentPixels !== 0) {
      throw new Error(
        `Studio visual "${route.name}" differs by ${comparison.differentPixels} pixels (${comparison.dimensions}). Inspect ${actualPath}.`,
      );
    }
  }
  process.stdout.write(
    `${update ? "Updated and inspected" : "Matched"} ${routes.length} full-page CRC studio visual baselines.\n`,
  );
} catch (error) {
  if (serverOutput) process.stderr.write(serverOutput);
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
