import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const base = process.env.PIBBL_WEBSITE_URL ?? "http://localhost:4321";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${base}/#/api/types/canvas-runtime#signaloptions`);
  await page.waitForURL(/\/reference\/types\/canvas-runtime\/#signaloptions$/);
  await page.goto(`${base}/reference/functions/signal/`);
  await page
    .getByRole("button", { name: "Search documentation", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("combobox").fill("SignalOptions");
  await page.getByRole("dialog").getByRole("option").first().click();
  await page.waitForURL(/\/reference\/types\/canvas-runtime\/#signaloptions$/);
  await page.goto(`${base}/reference/functions/signal/`);
  await page
    .getByRole("heading", { name: "API details from source", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "API details from source", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/pibbl-unified-reference.png" });
  await page.getByRole("link", { name: /View source —/ }).click();
  assert.match(page.url(), /\/source\/.*#L\d+$/);
  assert.match(
    await page.locator(new URL(page.url()).hash).innerText(),
    /export function signal/,
  );
  await page.goto(`${base}/playground/#/examples/drawing/circle`);
  await page
    .getByText("Live · changes run automatically", { exact: true })
    .waitFor({ timeout: 90000 });
  assert.equal(await page.locator("h1").innerText(), "Playground");
  assert.equal(await page.locator(".studio-sidebar").count(), 0);
  assert.equal(
    await page.locator("astro-dev-toolbar, vite-error-overlay").count(),
    0,
  );
  const canvas = () =>
    page.frameLocator(".studio-preview__frame").locator("canvas").first();
  const pixel = () =>
    canvas().evaluate((canvas) => [
      ...canvas
        .getContext("2d")
        .getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data,
    ]);
  assert.deepEqual(await pixel(), [255, 107, 87, 255]);
  const source = await readFile(
    new URL(
      "../packages/scenarios/src/learning/drawing/circle.example.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  await page.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(source.replace("#ff6b57", "#0044ff"));
  await page.waitForURL(/code=v1\./);
  // Old root-hash shares must migrate and restore the actual edited pixels.
  await page.goto(`${base}/${new URL(page.url()).hash}`);
  await page.waitForURL(/\/playground\/#\/examples\/drawing\/circle\?code=/);
  await page
    .getByText("Live · changes run automatically", { exact: true })
    .waitFor({ timeout: 90000 });
  assert.deepEqual(await pixel(), [0, 68, 255, 255]);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page
    .getByText("Live · changes run automatically", { exact: true })
    .waitFor();
  assert.deepEqual(await pixel(), [255, 107, 87, 255]);
  assert.ok(!page.url().includes("code="));
  await page.locator("#website-playground").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/pibbl-unified-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: "/tmp/pibbl-unified-mobile.png" });
  assert.deepEqual(errors, []);
  process.stdout.write(
    "PASS: source links, same-site editor, changed pixels after editing/shared-link reload, reset, desktop/mobile layout, and console.\n",
  );
} finally {
  await browser.close();
}
