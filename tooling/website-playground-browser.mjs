import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.PIBBL_WEBSITE_URL ?? "http://localhost:4321";
const playground = process.env.PIBBL_PLAYGROUND_PATH ?? "/playground/";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  // Observe the demo's public rendered labels, including asynchronous font errors.
  await page.addInitScript(() => {
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    globalThis.demoText = [];
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      globalThis.demoText.push(String(text));
      return fillText.call(this, text, ...args);
    };
  });
  await page.goto(`${base}${playground}#/examples/drawing/text-envelope`);
  await page.locator(".studio-preview__frame").waitFor();
  let frame = page.frames().find((frame) => frame.url() === "about:srcdoc");
  assert.ok(frame);
  await frame.waitForFunction(() =>
    globalThis.demoText.some((text) => /outline segments/.test(text)),
  );
  assert.ok(
    !(await frame.evaluate(() => globalThis.demoText)).some((text) =>
      /failed|paused/i.test(text),
    ),
  );
  await frame
    .getByRole("textbox", { name: "Text to warp" })
    .fill("HELLO CANVAS");
  await frame.getByLabel("Envelope preset").selectOption("Wave");
  await page.locator(".studio-preview__frame").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/pibbl-playground-envelope.png" });

  await page.goto(
    `${base}${playground}#/examples/events-and-interaction/drag-and-drop`,
  );
  await page.locator(".studio-preview__frame").waitFor();
  frame = page.frames().find((frame) => frame.url() === "about:srcdoc");
  await frame.waitForFunction(() => globalThis.demoText.includes("DROP ZONE"));
  const canvas = frame.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  assert.ok(box);
  // Start and finish on the painted labels, which must not block either rectangle.
  const point = (x, y) => ({
    x: box.x + (box.width * x) / 720,
    y: box.y + (box.height * y) / 420,
  });
  await frame.evaluate(() => {
    globalThis.dragPreview = undefined;
    const setDragImage = DataTransfer.prototype.setDragImage;
    DataTransfer.prototype.setDragImage = function (image, x, y) {
      globalThis.dragPreview = {
        width: image.width,
        height: image.height,
        pixel: [...image.getContext("2d").getImageData(20, 20, 1, 1).data],
      };
      return setDragImage.call(this, image, x, y);
    };
  });
  await page.mouse.move(...Object.values(point(187, 174)));
  await page.mouse.down();
  await page.mouse.move(...Object.values(point(533, 174)), { steps: 25 });
  await page.mouse.up();
  await frame.waitForFunction(() =>
    globalThis.demoText.some((text) => /dropped: pibbl-cargo/.test(text)),
  );
  assert.deepEqual(await frame.evaluate(() => globalThis.dragPreview), {
    width: 226,
    height: 176,
    pixel: [31, 75, 216, 255],
  });
  await page.screenshot({ path: "/tmp/pibbl-playground-drag.png" });
  // The canvas must reject native drags beginning outside the cargo.
  assert.equal(
    await canvas.evaluate((canvas) => {
      const event = new DragEvent("dragstart", {
        bubbles: true,
        cancelable: true,
        clientX: canvas.getBoundingClientRect().left + 5,
        clientY: canvas.getBoundingClientRect().top + 5,
        dataTransfer: new DataTransfer(),
      });
      canvas.dispatchEvent(event);
      return event.defaultPrevented;
    }),
    true,
  );
  await page.goto(`${base}/examples/`);
  assert.equal(await page.locator(".studio-preview__frame").count(), 0);
  assert.equal(await page.locator("vite-error-overlay").count(), 0);
  assert.deepEqual(errors, []);
  process.stdout.write(
    "PASS: playground font outlines, text/preset controls, real cargo drag/drop over labels, cropped drag preview, rejected background drags, and cleanup.\n",
  );
} finally {
  await browser.close();
}
