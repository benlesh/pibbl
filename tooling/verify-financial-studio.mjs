import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const origin = process.env.PIBBL_FINANCIAL_ORIGIN ?? "http://127.0.0.1:5176";
const browser = await chromium.launch({ headless: true });
await mkdir("/tmp/pibbl-financial-evidence", { recursive: true });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1400, height: 1000 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    await context.addInitScript(() => {
      globalThis.__financialText = [];
      const native = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        globalThis.__financialText.push(String(text));
        return native.call(this, text, ...args);
      };
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const slug of [
      "financial-volume",
      "financial-candles",
      "financial-trading-time",
      "financial-market-session",
    ]) {
      await page.goto(`${origin}/#/examples/composition/${slug}`);
      await page.waitForSelector("iframe");
      const frame = page.frames().find((frame) => frame !== page.mainFrame());
      await frame.waitForFunction(
        () => typeof globalThis.__PIBBL_EXAMPLE_MOUNT__ === "function",
      );
      const canvas = frame.locator("canvas");
      await canvas.waitFor();
      await page.waitForTimeout(250);
      const bounds = await canvas.boundingBox();
      assert(bounds?.width > 100);
      const initial = await frame.evaluate(
        () => globalThis.__financialText.length,
      );
      const position = {
        x:
          16 +
          (bounds.width - 68) *
            (slug === "financial-trading-time" ? 0.16 : 0.4),
        y: slug === "financial-market-session" ? 140 : 100,
      };
      if (mobile) await canvas.tap({ position });
      else await canvas.hover({ position });
      await page.waitForTimeout(100);
      const fresh = await frame.evaluate(
        (start) => globalThis.__financialText.slice(start),
        initial,
      );
      assert(
        fresh.length > 0,
        `${slug}: native ${mobile ? "touch" : "hover"} must update the scene`,
      );
      if (slug === "financial-trading-time")
        assert(fresh.includes("Fri · 02 Oct 16:00 UTC · $101.00"));
      if (slug === "financial-candles")
        assert(fresh.some((text) => text.startsWith("O ")));
      if (slug === "financial-volume")
        assert(fresh.some((text) => text.includes("shares")));
      if (slug === "financial-market-session") {
        const point = {
          x: 16 + (6.5 / 56) * (bounds.width - 94),
          y: bounds.height - 36,
        };
        if (mobile) await canvas.tap({ position: point });
        else await canvas.click({ position: point });
        await page.waitForTimeout(70);
        await page.mouse.move(0, 0);
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(70);
        const texts = await frame.evaluate(() => globalThis.__financialText);
        assert(texts.includes("13 Jan 2026"));
        assert(texts.includes("14 Jan 2026"));
      }
      if (slug === "financial-trading-time") {
        const point = { x: 80, y: bounds.height - 32 };
        if (mobile) await canvas.tap({ position: point });
        else await canvas.click({ position: point });
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(70);
        if (!mobile)
          assert(
            (await frame.evaluate(() => globalThis.__financialText)).some(
              (text) => text.includes("0.5") && text.includes("3.5"),
            ),
          );
      }
      assert(
        (await page.locator("body").innerText()).includes(
          "No TypeScript issues.",
        ),
        `${slug}: editor typecheck`,
      );
      const png = await canvas.evaluate(
        (canvas) => canvas.toDataURL("image/png").split(",")[1],
      );
      await writeFile(
        `/tmp/pibbl-financial-evidence/${slug}-${mobile ? "mobile" : "desktop"}.png`,
        Buffer.from(png, "base64"),
      );
      const themePoint = { x: bounds.width - 46, y: 22 };
      if (mobile) await canvas.tap({ position: themePoint });
      else await canvas.click({ position: themePoint });
      await page.waitForTimeout(70);
      assert.deepEqual(
        await canvas.evaluate((canvas) => [
          ...canvas.getContext("2d").getImageData(1, 1, 1, 1).data,
        ]),
        [246, 248, 251, 255],
        `${slug}: light palette`,
      );
      const lightPng = await canvas.evaluate(
        (canvas) => canvas.toDataURL("image/png").split(",")[1],
      );
      await writeFile(
        `/tmp/pibbl-financial-evidence/${slug}-${mobile ? "mobile" : "desktop"}-light.png`,
        Buffer.from(lightPng, "base64"),
      );
      await page.keyboard.press("Space");
      await page.waitForTimeout(70);
      assert.deepEqual(
        await canvas.evaluate((canvas) => [
          ...canvas.getContext("2d").getImageData(1, 1, 1, 1).data,
        ]),
        [13, 20, 34, 255],
        `${slug}: keyboard restores dark palette`,
      );
      console.warn(
        `${slug} ${mobile ? "touch mobile" : "desktop hover"}: native interaction, both palettes, keyboard toggle, editor and capture passed (${Math.round(bounds.width)}×${Math.round(bounds.height)})`,
      );
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser.close();
}
