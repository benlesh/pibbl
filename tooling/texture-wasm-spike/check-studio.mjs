import assert from "node:assert/strict";
import { chromium } from "playwright";
const origin = process.env.PIBBL_STUDIO_ORIGIN ?? "http://127.0.0.1:4382";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/#/examples/composition/stirred-ink`);
  await page.getByText("No TypeScript issues.", { exact: true }).waitFor();
  const frame = page
    .frames()
    .find((candidate) => candidate.url() === "about:srcdoc");
  assert.ok(frame, "Studio must mount the editable example");
  const canvas = frame.locator("canvas").first();
  await canvas.waitFor();
  await frame.evaluate(() => {
    window.inkUploads = 0;
    const put = OffscreenCanvasRenderingContext2D.prototype.putImageData;
    OffscreenCanvasRenderingContext2D.prototype.putImageData = function (
      image,
      ...args
    ) {
      if (image.width === 256 && image.height === 128) window.inkUploads++;
      return put.call(this, image, ...args);
    };
  });
  const uploads = () => frame.evaluate(() => window.inkUploads);
  async function button(x) {
    const box = await canvas.boundingBox();
    assert.ok(box);
    await page.mouse.click(
      box.x + (x * box.width) / 600,
      box.y + (540 * box.height) / 580,
    );
    await page.waitForTimeout(150);
  }
  async function interval() {
    const before = await uploads();
    await page.waitForTimeout(500);
    return (await uploads()) - before;
  }
  assert.ok((await interval()) > 5, "Living ink must advance");
  await canvas.scrollIntoViewIfNeeded();
  await button(96); // Pause reaction.
  await button(296); // Stop stirring.
  assert.equal(await interval(), 0, "Both paused means no ink work");
  const resetBefore = await uploads();
  await button(496);
  assert.equal(
    (await uploads()) - resetBefore,
    1,
    "Reset publishes once while paused",
  );
  await button(296); // Stir without reaction.
  assert.ok((await interval()) > 5, "Physics must stir paused ink");
  await button(296); // Stop stirring.
  await button(96); // Resume reaction without stirring.
  assert.ok((await interval()) > 5, "Reaction must resume independently");
  assert.deepEqual(errors, []);
  await canvas.screenshot({
    path: "/private/tmp/pibbl-stirred-studio-canvas.png",
  });
  console.warn(
    "Studio Stirred Ink: editor, pause, stir, reset, resume, and runtime checks passed.",
  );
} finally {
  await browser.close();
}
