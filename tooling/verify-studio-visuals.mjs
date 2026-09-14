import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";

const workspaceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const update = process.argv.includes("--update");
const requestedRouteNames = process.argv
  .filter((argument) => argument.startsWith("--route="))
  .map((argument) => argument.slice("--route=".length));
const previewPort = process.env.CRC_STUDIO_PREVIEW_PORT ?? "4174";
if (!/^[1-9]\d{0,4}$/.test(previewPort) || Number(previewPort) > 65_535) {
  throw new Error(
    `CRC_STUDIO_PREVIEW_PORT must be an integer from 1 through 65535; received ${JSON.stringify(previewPort)}.`,
  );
}
const origin = `http://127.0.0.1:${previewPort}`;
const allRoutes = [
  {
    name: "learn-landing",
    hash: "#/learn",
    ready: ".documentation-body a[href='#/learn/tutorials/diagram-editor']",
  },
  { name: "api-crc", hash: "#/api/functions/crc", ready: ".documentation-page h1" },
  { name: "examples-landing", hash: "#/examples", ready: ".studio-hero-canvas canvas" },
  {
    name: "filters",
    hash: "#/examples/drawing/filters",
    ready: ".studio-preview__frame",
    waitForWorkbench: true,
  },
  {
    name: "diagram-editor-landing",
    hash: "#/learn/tutorials/diagram-editor",
    ready: "img[src$='/tutorials/diagram-editor/finished-editor.png']",
  },
  {
    name: "diagram-editor-finished",
    hash: "#/learn/tutorials/diagram-editor/finished-editor",
    ready: ".studio-preview__frame",
    waitForWorkbench: true,
    captureSelector: ".studio-preview__frame",
  },
  {
    name: "search-open",
    hash: "#/learn",
    ready: ".documentation-body a[href='#/learn/tutorials/diagram-editor']",
    openSearch: true,
  },
  {
    name: "test-lab",
    hash: "#/testing/baseline-smoke",
    ready: ".testing-area .scenario-detail__title",
  },
];
const routeNames = new Set(allRoutes.map(({ name }) => name));
const unknownRouteNames = requestedRouteNames.filter(
  (name) => !routeNames.has(name),
);
if (unknownRouteNames.length > 0) {
  throw new Error(
    `Unknown CRC Studio visual route(s): ${unknownRouteNames.join(", ")}.`,
  );
}
const requestedRouteNameSet = new Set(requestedRouteNames);
const routes =
  requestedRouteNames.length === 0
    ? allRoutes
    : allRoutes.filter(({ name }) => requestedRouteNameSet.has(name));

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
  await mkdir(resolve(workspaceRoot, "test-screenshots/studio"), {
    recursive: true,
  });

  for (const route of routes) {
    await page.goto(`${origin}/${route.hash}`);
    await page.locator(route.ready).waitFor({ timeout: 30_000 });
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    if (route.openSearch) {
      await page.getByRole("button", { name: "Search documentation" }).first().click();
      await page.locator(".studio-search-dialog[open]").waitFor({ timeout: 30_000 });
    }
    if (route.waitForWorkbench) {
      if (route.captureSelector)
        await page.locator(route.ready).scrollIntoViewIfNeeded();
      await page
        .getByText("Live · changes run automatically")
        .waitFor({ timeout: 30_000 });
      const frames = page.locator(".studio-preview__frame");
      const frameCount = await frames.count();
      const sandbox = await frames.first().getAttribute("sandbox");
      if (frameCount !== 1 || sandbox !== "allow-scripts") {
        throw new Error(
          `Studio lesson must use exactly one opaque script-only preview frame; received ${frameCount} frame(s) with sandbox=${JSON.stringify(sandbox)}.`,
        );
      }
    }
    if (route.name === "test-lab") {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForFunction(() => window.scrollY === 0);
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
    if (route.name === "test-lab") {
      // Chromium can return a background-only first full-page capture after
      // this canvas-backed SPA route. Prime that compositor capture once; the
      // next, normal capture below remains the only baseline comparison.
      await page.screenshot({ fullPage: true, animations: "disabled" });
    }
    const actualPath = resolve(
      workspaceRoot,
      `test-screenshots/studio/${route.name}.actual.png`,
    );
    const actual = route.captureSelector
      ? await page.locator(route.captureSelector).screenshot({
          animations: "disabled",
        })
      : route.name === "test-lab"
        ? (await page.screenshot({
            path: actualPath,
            fullPage: true,
            animations: "disabled",
          }),
          await readFile(actualPath))
      : await page.screenshot({
          fullPage: true,
          animations: "disabled",
        });
    if (route.openSearch) await page.keyboard.press("Escape");
    const baselinePath = resolve(
      workspaceRoot,
      `packages/core/test/visual-baselines/studio-${route.name}.expected.png`,
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
    `${update ? "Updated and inspected" : "Matched"} ${routes.length} CRC studio visual baselines.\n`,
  );
} catch (error) {
  if (serverOutput) process.stderr.write(serverOutput);
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
