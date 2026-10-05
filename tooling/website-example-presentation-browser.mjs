import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch();
const base = process.env.CRC_WEBSITE_URL ?? "http://localhost:4321";
try {
  const page = await browser.newPage({ viewport: { width: 680, height: 540 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  async function open(id) {
    await page.goto(`${base}/minimal-runtime/${id}.html`);
    await page.waitForFunction(
      () => document.body.dataset.exampleReady === "true",
    );
  }
  await open("lifecycle/texture");
  const canvasBox = await page.locator("canvas").boundingBox();
  const buttonBox = await page.getByRole("button").boundingBox();
  assert.ok(
    buttonBox.y >= canvasBox.y + canvasBox.height,
    "example controls belong below the canvas, not beside its bottom edge",
  );
  for (const id of [
    "transitions/bifrost",
    "transitions/hologram",
    "textures/texture-lightning",
    "textures/texture-tendrils",
  ]) {
    await open(id);
    await page.waitForTimeout(600);
    const pixel = await page
      .locator("canvas")
      .first()
      .evaluate((canvas) => [
        ...canvas.getContext("2d").getImageData(4, 4, 1, 1).data,
      ]);
    assert.ok(
      pixel[3] === 255 && Math.max(...pixel.slice(0, 3)) < 50,
      `${id}: luminous effects need an opaque dark stage`,
    );
  }
  for (const [id, count] of [
    ["filter-tone", 4],
    ["filter-color", 4],
    ["filter-blur-shadow", 3],
    ["filter-finish", 3],
    ["filter-water-light", 4],
  ]) {
    await open(`filters/${id}`);
    assert.equal(
      await page.locator("figure").count(),
      count,
      `${id}: separate original and individual effects`,
    );
    assert.equal(
      await page.locator("figcaption").first().innerText(),
      "Original",
    );
  }
  for (const id of [
    "texture-water-waves",
    "texture-water-surface",
    "texture-rain-drops",
  ]) {
    await open(`textures/${id}`);
    await page.waitForTimeout(900);
    const colors = await page.locator("canvas").evaluate((canvas) => {
      const data = canvas
        .getContext("2d")
        .getImageData(30, 30, canvas.width - 60, canvas.height - 60).data;
      const colors = new Set();
      for (let i = 0; i < data.length; i += 16)
        colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      return colors.size;
    });
    assert.ok(
      colors > 20,
      `${id}: refraction needs interior detail, not a solid rectangle`,
    );
    const toggle = page.getByRole("checkbox");
    await toggle.uncheck();
    await page.waitForTimeout(150);
    const original = await page
      .locator("canvas")
      .evaluate((canvas) => canvas.toDataURL());
    await page.waitForTimeout(150);
    assert.equal(
      await page.locator("canvas").evaluate((canvas) => canvas.toDataURL()),
      original,
      `${id}: disabled refraction leaves the original subject unchanged`,
    );
    await toggle.check();
    await page.waitForTimeout(150);
    assert.notEqual(
      await page.locator("canvas").evaluate((canvas) => canvas.toDataURL()),
      original,
      `${id}: comparison toggle restores the effect`,
    );
    const box = await page.locator("canvas").boundingBox();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, {
      steps: 8,
    });
    await page.mouse.up();
  }
  await open("textures/texture-material-recipes");
  assert.deepEqual(await page.locator("figcaption").allTextContents(), [
    "Marble",
    "Paper",
    "Cellular",
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/minimal-examples/filters/filter-water-light/`);
  const preview = page.frameLocator("[data-minimal-preview] iframe");
  await preview.locator("body[data-example-ready='true']").waitFor();
  await page.waitForTimeout(200);
  assert.equal(
    await preview
      .locator("body")
      .evaluate(() => document.documentElement.scrollHeight > innerHeight),
    false,
    "mobile comparisons fit the preview without a second vertical scrollbar",
  );
  assert.deepEqual(errors, [], "examples have no uncaught browser errors");
  process.stdout.write(
    "PASS: dark luminous stages, isolated filter comparisons, detailed refraction subjects.\n",
  );
} finally {
  await browser.close();
}
