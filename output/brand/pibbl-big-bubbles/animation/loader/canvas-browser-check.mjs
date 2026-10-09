import { chromium } from "playwright";
import assert from "node:assert/strict";
const url =
  process.env.PIBBL_LOADER_URL ??
  "http://127.0.0.1:8766/canvas-comparison.html";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(url);
  assert.equal(await page.title(), "Pibbl · SVG / Canvas comparison");
  await page.waitForFunction(() => window.comparison?.loader.time > 0);
  process.stdout.write(
    JSON.stringify(
      await page.evaluate(async () => {
        const { evidence } = await import("./canvas-evidence.mjs");
        return evidence();
      }),
    ) + "\n",
  );
  await page.getByText("Pause", { exact: true }).click();
  await page.evaluate(() => window.comparison.loader.seek(8550));
  await page.waitForTimeout(80);
  await page.screenshot({ path: "/tmp/pibbl-canvas-catch.png" });
  await page.getByText("Ready", { exact: true }).click();
  await page.waitForTimeout(3000);
  assert.equal(
    await page.evaluate(() => window.comparison.loader.phase),
    "complete",
  );
  assert.equal(await page.evaluate(() => window.comparison.completed), 1);
  await page.screenshot({ path: "/tmp/pibbl-canvas-complete.png" });
  for (const background of ["#fff", "#141820", ""]) {
    await page.locator("#background").selectOption(background);
    assert.equal(
      await page
        .locator(".stage")
        .first()
        .evaluate((el) => el.style.background),
      background === "#fff"
        ? "rgb(255, 255, 255)"
        : background === "#141820"
          ? "rgb(20, 24, 32)"
          : "",
    );
  }
  for (const dpr of [1, 2, 3]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: dpr,
    });
    const mobile = await context.newPage();
    await mobile.goto(url);
    await mobile.waitForFunction(() => window.comparison?.loader.time > 0);
    const size = await mobile.locator("canvas").evaluate((c) => ({
      width: c.width,
      css: c.getBoundingClientRect().width,
    }));
    assert.equal(size.width, Math.round(size.css * dpr));
    await mobile.getByText("Pause", { exact: true }).click();
    await mobile.evaluate(() => window.comparison.loader.seek(4200));
    await mobile.waitForTimeout(50);
    if (dpr === 2)
      await mobile.screenshot({ path: "/tmp/pibbl-canvas-mobile.png" });
    await context.close();
  }
  // Observe the whole normal-speed loop, not only deterministic poses.
  await page.getByText("Restart", { exact: true }).click();
  await page.waitForTimeout(11500);
  assert.equal(
    await page.evaluate(() => window.comparison.loader.phase),
    "loading",
  );
  assert.deepEqual(errors, []);
  process.stdout.write(
    "PASS: page identity, visible content, no overlay/errors, Ready interaction, normal-speed loop, mobile DPR 1/2/3\n",
  );
} finally {
  await browser.close();
}
