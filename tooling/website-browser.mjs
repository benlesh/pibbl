import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.CRC_WEBSITE_URL ?? "http://localhost:4321";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(`${base}/guides/native-button/`);
  assert.equal(await page.locator("h1").count(), 1);
  const button = page.getByRole("button", { name: "Try CRC" });
  await button.click();
  await page.getByText("Activated 1 time").waitFor();
  await button.focus();
  await page.keyboard.press("Enter");
  await page.getByText("Activated 2 times").waitFor();
  await page.keyboard.press("Space");
  await page.getByText("Activated 3 times").waitFor();
  await page.getByLabel("Disable button").check();
  assert.equal(await button.isDisabled(), true);
  await page.getByLabel("Disable button").uncheck();
  await page.getByLabel("Enable effect").uncheck();
  await button.click();
  await page.getByText("Activated 4 times").waitFor();
  await page.getByLabel("Enable effect").check();
  await page.locator('[data-ink-state="running"]').waitFor();
  const dimensions = await page.locator("#ink-canvas").evaluate((c) => ({
    width: c.width,
    css: c.getBoundingClientRect().width,
  }));
  assert.ok(dimensions.width > 0 && dimensions.css > 0);
  assert.equal(
    await page
      .locator("#ink-canvas")
      .evaluate((c) => Math.round(c.getBoundingClientRect().height)),
    await button.evaluate((b) => Math.round(b.getBoundingClientRect().height)),
  );
  const pixels = () =>
    page.locator("#ink-canvas").evaluate((c) => c.toDataURL());
  const firstFrame = await pixels();
  await page.waitForFunction(
    (first) => document.querySelector("#ink-canvas").toDataURL() !== first,
    firstFrame,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator('[data-ink-state="paused"]').waitFor();
  await page.waitForTimeout(100);
  const pausedFrame = await pixels();
  await page.waitForTimeout(100);
  assert.equal(
    await pixels(),
    pausedFrame,
    "reduced motion freezes the actual pixels",
  );
  await page.screenshot({
    path: "/tmp/crc-website-desktop.png",
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/crc-website-mobile.png",
    fullPage: false,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  const noJS = await browser.newPage({ javaScriptEnabled: false });
  await noJS.goto(`${base}/start/`);
  await noJS.getByRole("heading", { name: "Start", exact: true }).waitFor();
  await noJS
    .locator('main a[href="/guides/add-to-your-site/"]')
    .first()
    .click();
  assert.match(noJS.url(), /guides\/add-to-your-site/);
  for (const kind of ["shapes/circle", "filters/blur", "textures/marble"]) {
    await page.goto(`${base}/catalogs/${kind}/`);
    await page.waitForFunction(() => {
      const c = document.querySelector(".demo-canvas");
      return (
        c &&
        c
          .getContext("2d")
          .getImageData(0, 0, c.width, c.height)
          .data.some((value, index) => index % 4 === 3 && value > 0)
      );
    });
  }
  await page.goto(`${base}/`);
  await page.getByRole("heading", { name: "CRC", exact: true }).waitFor();
  await page.screenshot({ path: "/tmp/crc-website-start.png" });
  const editorLink = await page
    .locator('a[href="/playground/"]')
    .first()
    .getAttribute("href");
  await page.goto(new URL(editorLink, base).href);
  const editorURL = await page
    .getByRole("link", { name: "Open the existing Studio editor" })
    .getAttribute("href");
  await page.goto(editorURL);
  await page
    .frameLocator('iframe[title="Live CRC lesson preview"]')
    .locator("canvas")
    .waitFor();
  await page.goto(
    editorURL.replace("drawing/circle", "composition/stirred-ink"),
  );
  await page
    .frameLocator('iframe[title="Live CRC lesson preview"]')
    .locator("canvas")
    .waitFor();
  assert.deepEqual(errors, []);
  process.stdout.write(
    "PASS: native click, keyboard, disabled, disposal/remount, reduced motion, responsive layout, no-JS navigation, catalog pixels; no page errors.\n",
  );
} finally {
  await browser.close();
}
