import assert from "node:assert/strict";
import { chromium } from "playwright";
import { galleryExamples } from "../website/gallery.mjs";

const base = process.env.CRC_WEBSITE_URL ?? "http://localhost:4321";
const update = process.argv.includes("--update-previews");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const example of galleryExamples) {
    await page.goto(`${base}/experience/${example.slug}/`);
    await page
      .locator("[data-status]")
      .filter({ hasText: /^Running$/ })
      .waitFor();
    await page.waitForTimeout(1000);
    const canvas = page.locator("[data-effect-demo] canvas");
    const colors = await canvas.evaluate((canvas) => {
      const pixels = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set();
      for (let i = 0; i < pixels.length; i += 64)
        colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
      return colors.size;
    });
    assert.ok(colors >= 8, `${example.slug} appears blank`);
    if (update)
      await canvas.screenshot({
        path: new URL(
          `../website/public/previews/${example.slug}.png`,
          import.meta.url,
        ).pathname,
      });
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await page
      .locator("[data-status]")
      .filter({ hasText: /^Stopped$/ })
      .waitFor();
    assert.deepEqual(errors, [], example.slug);
    process.stdout.write(
      `PASS ${example.slug}: autoplay, nonblank Canvas, stop\n`,
    );
  }
} finally {
  await browser.close();
}
