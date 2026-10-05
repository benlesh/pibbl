import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const workspaceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const update = process.argv.includes("--update");
const previewPort = process.env.CRC_DIAGRAM_TUTORIAL_PREVIEW_PORT ?? "4175";
if (!/^[1-9]\d{0,4}$/.test(previewPort) || Number(previewPort) > 65_535) {
  throw new Error(
    `CRC_DIAGRAM_TUTORIAL_PREVIEW_PORT must be an integer from 1 through 65535; received ${JSON.stringify(previewPort)}.`,
  );
}

const origin = `http://127.0.0.1:${previewPort}`;
const teaserPath = resolve(
  workspaceRoot,
  "playground/public/tutorials/diagram-editor/finished-editor.png",
);

async function waitForServer(process) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (process.exitCode !== null) {
      throw new Error(
        `Diagram-editor preview server exited with code ${process.exitCode}.`,
      );
    }
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error("Timed out waiting for the diagram-editor preview server.");
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
        ) {
          differentPixels++;
        }
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
    previewPort,
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
  await page.goto(`${origin}/#/workbench/diagram-editor-finished`);
  const frames = page.locator("iframe");
  await frames.first().waitFor({ timeout: 30_000 });
  const frameCount = await frames.count();
  const sandbox = await frames.first().getAttribute("sandbox");
  if (frameCount !== 1 || sandbox !== "allow-scripts") {
    throw new Error(
      `Diagram-editor lesson must use exactly one opaque script-only preview frame; received ${frameCount} frame(s) with sandbox=${JSON.stringify(sandbox)}.`,
    );
  }
  await frames.first().evaluate((element) => {
    const host = element.parentElement;
    if (!(host instanceof HTMLElement)) {
      throw new Error("Diagram-editor preview frame must have a sizing host.");
    }
    host.style.width = "960px";
    host.style.height = "600px";
  });
  const canvas = frames.first().contentFrame().locator("canvas");
  await canvas.waitFor({ timeout: 30_000 });
  await canvas.evaluate((element) => {
    element.style.width = "960px";
    element.style.height = "600px";
  });
  await frames.first().scrollIntoViewIfNeeded();
  await page
    .getByText("Live · changes run automatically")
    .waitFor({ timeout: 30_000 });
  const imageDataUrl = await canvas.evaluate(async (element) => {
    await document.fonts.ready;
    await new Promise((resolvePromise) =>
      requestAnimationFrame(() => requestAnimationFrame(resolvePromise)),
    );
    if (!(element instanceof HTMLCanvasElement)) {
      throw new Error("Diagram-editor preview must render one Canvas.");
    }
    if (element.width !== 960 || element.height !== 600) {
      throw new Error(
        `Diagram-editor teaser Canvas must be 960×600; received ${element.width}×${element.height}.`,
      );
    }
    return element.toDataURL("image/png");
  });
  const actual = Buffer.from(imageDataUrl.slice(imageDataUrl.indexOf(",") + 1), "base64");
  const artifactDirectory = resolve(workspaceRoot, "test-screenshots/studio");
  await mkdir(artifactDirectory, { recursive: true });
  const actualPath = resolve(artifactDirectory, "diagram-editor-teaser.actual.png");
  await writeFile(actualPath, actual);

  if (update) {
    await mkdir(dirname(teaserPath), { recursive: true });
    await writeFile(teaserPath, actual);
    process.stdout.write(`Updated diagram-editor teaser ${teaserPath}.\n`);
  } else {
    const expected = await readFile(teaserPath).catch(() => undefined);
    if (!expected) {
      throw new Error(
        `Missing diagram-editor teaser ${teaserPath}. Run pnpm test:tutorial-teaser:update and inspect the generated image.`,
      );
    }
    const comparison = await pixelDifference(page, expected, actual);
    await writeFile(resolve(artifactDirectory, "diagram-editor-teaser.expected.png"), expected);
    await writeFile(resolve(artifactDirectory, "diagram-editor-teaser.comparison.json"), JSON.stringify({
      platform: process.platform,
      arch: process.arch,
      chromium: browser.version(),
      ...comparison,
    }, null, 2));
    if (comparison.differentPixels !== 0) {
      throw new Error(
        `Diagram-editor teaser differs by ${comparison.differentPixels} pixels (${comparison.dimensions}). Inspect ${actualPath} and its adjacent expected image and comparison metadata.`,
      );
    }
    process.stdout.write(
      `Matched diagram-editor teaser at ${comparison.dimensions} with zero differing pixels.\n`,
    );
  }
} catch (error) {
  if (serverOutput) process.stderr.write(serverOutput);
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
