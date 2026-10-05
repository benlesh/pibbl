import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.CRC_WEBSITE_URL ?? "http://localhost:4321";
const update = process.argv.includes("--update-previews");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const slug of ["text", "text-geometry", "text-envelope"]) {
    await page.goto(`${base}/experience/${slug}/`);
    await page
      .locator("[data-status]")
      .filter({ hasText: /^Running$/ })
      .waitFor();
    const canvas = page.locator("[data-effect-demo] canvas");
    if (slug === "text-geometry") {
      await page
        .getByRole("status")
        .filter({ hasText: /9 glyphs/ })
        .waitFor();
    } else if (slug === "text-envelope") {
      await page.waitForFunction(() => {
        const canvas = document.querySelector("canvas");
        const data = canvas
          .getContext("2d")
          .getImageData(200, 340, 550, 180).data;
        let ink = 0;
        for (let i = 0; i < data.length; i += 4)
          if (data[i] < 70 && data[i + 1] < 100) ink++;
        return ink > 10000;
      });
    }
    if (update)
      await canvas.screenshot({
        path: new URL(`../website/public/previews/${slug}.png`, import.meta.url)
          .pathname,
      });
    if (slug === "text-geometry") {
      await page.getByRole("textbox").fill("Bend");
      await page
        .getByRole("button", { name: "Generate outline", exact: true })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: /4 glyphs/ })
        .waitFor();
      await page
        .getByRole("button", { name: "Reset points", exact: true })
        .click();
    } else if (slug === "text-envelope") {
      const before = await canvas.evaluate((c) => c.toDataURL());
      await page.getByRole("button", { name: "+ Guide", exact: true }).click();
      await page.waitForFunction(
        (before) => document.querySelector("canvas").toDataURL() !== before,
        before,
      );
      const added = await canvas.evaluate((c) => c.toDataURL());
      const box = await canvas.boundingBox();
      await page.mouse.move(
        box.x + (290 * box.width) / 960,
        box.y + (210 * box.height) / 700,
      );
      await page.mouse.down();
      await page.mouse.move(
        box.x + (320 * box.width) / 960,
        box.y + (250 * box.height) / 700,
        { steps: 5 },
      );
      await page.mouse.up();
      await page.waitForFunction(
        (added) => document.querySelector("canvas").toDataURL() !== added,
        added,
      );
      await page
        .getByRole("textbox", { name: "Text to warp" })
        .fill("CURVED TYPE");
      await page.getByLabel("Envelope preset").selectOption("Wave");
      await page.getByRole("button", { name: "Reset", exact: true }).click();
    }
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    assert.equal(
      await page.getByRole("textbox").count(),
      0,
      `${slug} cleans up native controls`,
    );
    await page
      .getByRole("button", { name: "Run example", exact: true })
      .click();
    await page
      .locator("[data-status]")
      .filter({ hasText: /^Running$/ })
      .waitFor();
    assert.deepEqual(errors, [], slug);
    process.stdout.write(`PASS ${slug}: loaded, interacted, stopped, restarted\n`);
  }
} finally {
  await browser.close();
}
