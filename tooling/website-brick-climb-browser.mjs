import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.PIBBL_WEBSITE_URL ?? "http://localhost:4321";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(base) && response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  const response = await page.goto(`${base}/examples/brick-climb/`);
  assert.equal(response.status(), 200);
  assert.match(await page.title(), /Brick Climb/);
  const frame = page.frameLocator('iframe[title="Brick Climb game"]');
  await frame.locator("#start").click();
  await frame.locator("canvas").press("Escape");
  await frame.locator("[data-resume]").waitFor({ state: "visible" });
  assert.equal(
    await frame.locator("#status").textContent(),
    "BREAK · JUMP · COLLECT",
  );
  if (process.env.PIBBL_BRICK_SCREENSHOT)
    await page.screenshot({ path: process.env.PIBBL_BRICK_SCREENSHOT });
  await frame.locator("[data-resume]").click();
  await frame.locator(".pause-overlay").waitFor({ state: "detached" });
  await frame.locator("#restart").click();
  assert.equal(await frame.locator("#splash").isVisible(), false);
  await page.setViewportSize({ width: 390, height: 844 });
  const fits = await frame
    .locator(".cabinet")
    .evaluate(
      (element) => element.getBoundingClientRect().right <= window.innerWidth,
    );
  assert.ok(fits, "embedded game fits a narrow docs viewport");
  await page
    .getByRole("link", { name: "Play Brick Climb in a full page" })
    .click();
  await page.waitForURL("**/generated/games/brick-climb/");
  await page.locator("#start").waitFor({ state: "visible" });
  await page.goto(`${base}/generated/games/brick-climb/?preview`);
  await page.getByText("FRAME INSPECTOR").waitFor();
  assert.deepEqual(errors, []);
  process.stdout.write(
    "Brick Climb: docs embed, start, pause, resume, restart, narrow embed, full-page link, and sprite inspector passed.\n",
  );
} finally {
  await browser.close();
}
