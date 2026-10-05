import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = resolve(root, process.env.CRC_STUDIO_DOCS_PREVIEW_OUTPUT_DIRECTORY ?? "playground/dist");
const port = process.env.CRC_STUDIO_DOCS_PREVIEW_PORT ?? "4175";
if (!/^[1-9]\d{0,4}$/.test(port) || Number(port) > 65_535) {
  throw new Error(`Invalid Studio preview port: ${port}`);
}
const origin = `http://127.0.0.1:${port}`;
const website = "http://localhost:4321";

const server = spawn(process.execPath, [
  resolve(root, "node_modules/vite/bin/vite.js"),
  "preview", "--host", "127.0.0.1", "--port", port, "--strictPort", "--outDir", output,
], { cwd: resolve(root, "playground"), stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk; });
server.stderr.on("data", (chunk) => { serverOutput += chunk; });

async function waitForServer() {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (server.exitCode !== null) throw new Error(`Studio preview exited: ${serverOutput}`);
    try {
      if ((await fetch(origin)).ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(`Studio preview did not start: ${serverOutput}`);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route(`${website}/**`, (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>CRC website</title><h1>CRC website</h1>",
  }));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(`${origin}/#/examples`);
  await page.locator("#studio-main h1").waitFor();
  assert.equal(await page.locator("[data-navigation-id='learn']").first().getAttribute("href"), `${website}/guides/learning-path/`);
  assert.equal(await page.locator("[data-navigation-id='api']").first().getAttribute("href"), `${website}/reference/overview/`);
  assert.equal(await page.locator("[data-navigation-id='examples']").first().getAttribute("href"), "#/examples");

  await page.goto(`${origin}/#/learn/guides/configure-jsx`);
  await page.waitForURL(`${website}/guides/configure-jsx/`);
  await page.goto(`${origin}/#/api/types/events#crcpointerevent`);
  await page.waitForURL(`${website}/reference/types/events/#crcpointerevent`);

  await page.goto(`${origin}/#/workbench/diagram-editor-first-node`);
  await page.getByRole("heading", { name: "Draw the first node" }).waitFor();
  await page.locator(".studio-workbench .monaco-editor").waitFor({ timeout: 30_000 });
  assert.equal(await page.locator(".studio-workbench").count(), 1);
  await page.goto(`${origin}/#/examples/drawing/rectangle`);
  await page.getByRole("heading", { name: "Rectangle" }).waitFor();

  await page.locator(".studio-search-trigger--desktop").click();
  const input = page.locator(".studio-search-dialog__input");
  await input.fill("useComputed");
  const result = page.locator("[data-search-url='#/api/hooks/use-computed']").first();
  await result.waitFor({ timeout: 30_000 });
  await input.press("ArrowDown");
  await input.press("Enter");
  await page.waitForURL(`${website}/reference/hooks/use-computed/`);

  assert.deepEqual(errors, []);
  await context.close();
  process.stdout.write("Validated Studio documentation redirects, workbench, examples, and search.\n");
} catch (error) {
  if (serverOutput) process.stderr.write(serverOutput);
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
