import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const origin = process.env.PIBBL_INSPECTION_ORIGIN ?? "http://127.0.0.1:5176";
const browser = await chromium.launch({ headless: true });
await mkdir("/tmp/pibbl-inspection-evidence", { recursive: true });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1400, height: 1000 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const slug of [
      "viz-recorded-inspection",
      "viz-lazy-inspection",
      "viz-painted-inspection",
      "viz-inspection-workbench",
    ]) {
      await page.goto(`${origin}/#/examples/composition/${slug}`);
      await page.waitForSelector("iframe");
      const frame = page.frames().find((value) => value !== page.mainFrame());
      await frame.waitForFunction(
        () => typeof globalThis.PIBBL_CORE?.usePointInspection === "function",
      );
      await frame.waitForFunction(
        () => typeof globalThis.__PIBBL_EXAMPLE_MOUNT__ === "function",
      );
      await page.waitForTimeout(300);
      const canvas = frame.locator("canvas");
      const rect = await canvas.boundingBox();
      assert(rect?.width > 100);
      const dimensions =
        slug === "viz-inspection-workbench"
          ? { width: 1000, height: 640 }
          : { width: 340, height: 280 };
      await frame.evaluate(() => {
        globalThis.__inspectionText = [];
        const ctx = document.querySelector("canvas").getContext("2d");
        const original = ctx.fillText;
        ctx.fillText = function (text, ...args) {
          globalThis.__inspectionText.push(text);
          return original.call(this, text, ...args);
        };
      });
      const point =
        slug === "viz-recorded-inspection"
          ? { x: 160, y: 195 }
          : slug === "viz-inspection-workbench"
            ? { x: 400, y: 140 }
            : { x: 100, y: 100 };
      const position = {
        x: (point.x * rect.width) / dimensions.width,
        y: (point.y * rect.height) / dimensions.height,
      };
      if (mobile) await canvas.tap({ position });
      else await canvas.click({ position });
      await page.waitForTimeout(80);
      await page.keyboard.press(
        slug === "viz-inspection-workbench" ||
          slug === "viz-recorded-inspection"
          ? "ArrowRight"
          : "Enter",
      );
      await page.waitForTimeout(80);
      const texts = await frame.evaluate(() => globalThis.__inspectionText);
      assert(texts.length > 0, `${slug} must repaint after input`);
      if (slug === "viz-recorded-inspection")
        assert(
          texts.some((text) =>
            text.includes("$103.00 · source row 1 · 1 min away"),
          ),
        );
      if (slug === "viz-recorded-inspection")
        assert(
          texts.some((text) => text.includes("Order 09:39 → quote 09:40")),
        );
      if (slug === "viz-lazy-inspection")
        assert(
          texts.some((text) => text.includes("2 equal requests · 1 execution")),
        );
      if (slug === "viz-painted-inspection") {
        assert(texts.includes("Nearest center: Order A"));
        assert(texts.includes("Painted top mark: Order B"));
      }
      assert(
        (await page.locator("body").innerText()).includes(
          "No TypeScript issues.",
        ),
        `${slug} compiler must pass`,
      );
      await canvas.screenshot({
        path: `/tmp/pibbl-inspection-evidence/${slug}-${mobile ? "mobile" : "desktop"}.png`,
      });
      console.warn(
        `${mobile ? "mobile touch" : "desktop click"} ${slug}: compiler, input, repaint and screenshot pass`,
      );
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser.close();
}
