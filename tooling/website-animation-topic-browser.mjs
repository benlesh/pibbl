import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    `${process.env.CRC_WEBSITE_URL ?? "http://localhost:4321"}/agents/topics/animation/`,
  );
  assert.equal(
    await page.locator('[data-effect-demo="signals-and-animation"]').count(),
    1,
    "the agent example needs an inline live preview",
  );
  await page
    .locator("[data-status]")
    .filter({ hasText: /^Running$/ })
    .waitFor();
  const canvas = page.locator("[data-effect-demo] canvas");
  await page.waitForTimeout(150);
  const before = await canvas.evaluate((c) => [
    ...c.getContext("2d").getImageData(130, 150, 1, 1).data,
  ]);
  const box = await canvas.boundingBox();
  await page.mouse.click(
    box.x + (130 * box.width) / 720,
    box.y + (150 * box.height) / 420,
  );
  await page.waitForFunction(() => {
    const data = document
      .querySelector("[data-effect-demo] canvas")
      .getContext("2d")
      .getImageData(130, 150, 1, 1).data;
    return data[0] === 238 && data[1] === 242 && data[2] === 255;
  });
  const after = await canvas.evaluate((c) => [
    ...c.getContext("2d").getImageData(130, 150, 1, 1).data,
  ]);
  assert.notDeepEqual(
    before,
    after,
    "click starts entrance and moves the card away from its starting position",
  );
  assert.match(await page.locator("main").innerText(), /usePlayback\(entrance/);
  assert.deepEqual(errors, []);
  process.stdout.write(
    "PASS animation topic: inline example, entrance binding, click-to-play movement\n",
  );
} finally {
  await browser.close();
}
