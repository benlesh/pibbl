import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { loadOutlineFont, createTextGeometry } from "../dist/index.mjs";
const font = await loadOutlineFont(
  await readFile(new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url)),
);
const geometry = createTextGeometry(font, "A", { fontSize: 130 }).geometry;
const first = geometry.getSegment(0);
font.dispose();
let browser, studio;
try {
  let origin = process.env.CRC_TEXT_STUDIO_URL;
  if (!origin) {
    const { createServer, preview } = await import("vite");
    const root = fileURLToPath(
      new URL("../../../playground/", import.meta.url),
    );
    const options = {
      root,
      configFile: root + "vite.config.ts",
      logLevel: "error",
      mode: process.argv.includes("--built") ? "built" : "development",
    };
    if (process.argv.includes("--production")) {
      studio = await preview({
        ...options,
        preview: { host: "127.0.0.1", port: 0 },
      });
    } else {
      studio = await createServer({
        ...options,
        server: { host: "127.0.0.1", port: 0 },
      });
      await studio.listen();
    }
    origin = `http://127.0.0.1:${studio.httpServer.address().port}`;
  }
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const ownership = [];
  page.on("console", (message) => {
    const value = message.text();
    if (value.startsWith("__CRC_TEXT_OWNER__"))
      ownership.push(JSON.parse(value.slice("__CRC_TEXT_OWNER__".length)));
  });
  await page.route("**/crc-text/engine.mjs", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    assert.ok(
      source.includes("export default Module;"),
      "pinned loader export changed",
    );
    const instrumented = source.replace(
      "export default Module;",
      `export default async function(...args) {
    const engine=await Module(...args);
    for(const key of ['_crc_font_create','_crc_font_release']) {
      const original=engine[key];
      const wrapped=(...values)=>{const result=original(...values);engine[key]=wrapped;console.debug('__CRC_TEXT_OWNER__'+JSON.stringify({fonts:engine._crc_live_fonts(),results:engine._crc_live_results()}));return result;};
      engine[key]=wrapped;
    }
    return engine;
  }`,
    );
    await route.fulfill({ response, body: instrumented });
  });
  await page.goto(new URL("/#/examples/drawing/text-geometry", origin).href);
  const frame = page.frameLocator("iframe");
  const input = frame.getByRole("textbox", {
    name: "Text to turn into an outline",
  });
  await input.fill("A");
  await frame
    .getByRole("button", { name: "Generate outline", exact: true })
    .click();
  await page.waitForTimeout(500);
  await frame
    .getByRole("status")
    .filter({ hasText: "1 glyphs" })
    .waitFor({ timeout: 3000 });
  const canvas = frame.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const before = await canvas.screenshot();
  const box = await canvas.boundingBox();
  const size = await canvas.evaluate((c) => ({ w: c.width, h: c.height }));
  const scale = Math.min(box.width / 900, box.height / 480);
  const x = box.x + (box.width - 900 * scale) / 2 + (first.x + 38) * scale;
  const y = box.y + (box.height - 480 * scale) / 2 + (first.y + 290) * scale;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 45, y - 35, { steps: 8 });
  await page.mouse.up();
  await frame
    .getByRole("status")
    .filter({ hasText: "Point moved" })
    .waitFor({ timeout: 3000 });
  await page.waitForTimeout(100);
  const after = await canvas.screenshot();
  assert.notDeepEqual(after, before);

  await frame.getByRole("button", { name: "Reset points" }).click();
  await page.waitForTimeout(100);
  assert.deepEqual(await canvas.screenshot(), before);
  const hasOutline = () => canvas.evaluate((element) => {
    const pixels = element.getContext("2d").getImageData(0, 0, element.width, element.height).data;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] === 89 && pixels[i + 1] === 188 && pixels[i + 2] === 168) return true;
    }
    return false;
  });
  assert.equal(await hasOutline(), true);
  for (const text of ["😀", "Hello 👩‍💻", "🇺🇸"]) {
    await input.fill(text);
    await frame.getByRole("button", { name: "Generate outline", exact: true }).click();
    await frame.getByRole("alert").filter({ hasText: "missing a required glyph" }).waitFor({ timeout: 3000 });
    assert.equal(await frame.getByRole("button", { name: "Reset points" }).isDisabled(), true);
    await page.waitForTimeout(100);
    assert.equal(await hasOutline(), false);
  }
  await input.fill("A");
  await frame.getByRole("button", { name: "Generate outline", exact: true }).click();
  await frame.getByRole("status").filter({ hasText: "1 glyphs" }).waitFor();
  assert.equal(await frame.getByRole("alert").count(), 0);
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  assert.equal(await hasOutline(), true);
  assert.equal(await frame.getByRole("button", { name: "Reset points" }).isDisabled(), false);
  assert.ok(ownership.some((state) => state.fonts === 1));
  const release = page.waitForEvent("console", {
    predicate: (message) =>
      message.text().startsWith("__CRC_TEXT_OWNER__") &&
      JSON.parse(message.text().slice("__CRC_TEXT_OWNER__".length)).fonts === 0,
    timeout: 5000,
  });
  await page.evaluate(() => {
    location.hash = "/examples/drawing/rectangle";
  });
  await release;
  assert.deepEqual(ownership.at(-1), { fonts: 0, results: 0 });
  assert.deepEqual(errors, []);
  process.stdout.write(
    String(
      JSON.stringify({
        passed: [
          "type text",
          "generate path",
          "drag point changes rendered geometry",
          "reset restores original",
          "unsupported emoji show an alert and clear stale outlines",
          "supported text recovers after an error",
          "navigation releases native font and results",
          "no page errors",
        ],
        canvas: size,
      }),
    ) + "\n",
  );
} finally {
  await browser?.close();
  if (studio?.close) await studio.close();
  else if (studio)
    await new Promise((resolve) => studio.httpServer.close(resolve));
}
