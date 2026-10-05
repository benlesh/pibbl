import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = (process.env.PIBBL_WEBSITE_URL ?? "http://localhost:4321").replace(
  /\/$/u,
  "",
);
const browser = await chromium.launch();

async function openExample(id) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(
    `${base}/minimal-runtime/${id}.html`,
  );
  assert.equal(response?.status(), 200, id);
  await page.waitForFunction(
    () =>
      document.body.dataset.exampleReady || document.body.dataset.exampleError,
  );
  assert.equal(
    await page.locator("body").getAttribute("data-example-error"),
    null,
    id,
  );
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return false;
    const { width, height } = canvas;
    const pixels = canvas
      .getContext("2d")
      ?.getImageData(0, 0, width, height).data;
    if (!pixels) return false;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] !== 0) return true;
    }
    return false;
  });
  return { page, errors };
}

async function run(id, check) {
  const { page, errors } = await openExample(id);
  try {
    await check(page);
    assert.deepEqual(errors, [], `${id} page errors`);
    process.stdout.write(`PASS ${id}\n`);
  } finally {
    await page.close();
  }
}

try {
  await run("render-layers/three-layer", async (page) => {
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    assert.ok(box);
    await page.mouse.click(box.x + 160, box.y + 110);
    await page.waitForFunction(() =>
      document.querySelector("p")?.textContent?.startsWith("Cube rotation:"),
    );
    assert.match(
      await page.locator("p").textContent(),
      /^Cube rotation: 0\.39 radians$/u,
    );
  });

  await run("render-layers/orbit-controls", async (page) => {
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + 160, box.y + 110);
    await page.mouse.down();
    await page.mouse.move(box.x + 205, box.y + 130, { steps: 7 });
    await page.mouse.up();
    await page.waitForFunction(() =>
      document.querySelector("p")?.textContent?.startsWith("Camera azimuth:"),
    );
    const azimuth = Number(
      (await page.locator("p").textContent())?.match(
        /Camera azimuth: (-?\d+\.\d+)/u,
      )?.[1],
    );
    assert.ok(Number.isFinite(azimuth) && Math.abs(azimuth) > 0.1);
  });

  await run("manipulation/basic", async (page) => {
    const bounds = await page.locator("canvas").evaluate((canvas) => {
      const { width, height } = canvas;
      const data = canvas
        .getContext("2d")
        .getImageData(0, 0, width, height).data;
      let left = width;
      let top = height;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (data[(y * width + x) * 4 + 3] === 0) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
      return { width, height, left, top, right, bottom };
    });
    assert.ok(bounds.right >= 0, "manipulation scene painted no pixels");
    assert.ok(bounds.left > 16 && bounds.top > 16, JSON.stringify(bounds));
    assert.ok(bounds.right < bounds.width - 16, JSON.stringify(bounds));
    assert.ok(bounds.bottom < bounds.height - 16, JSON.stringify(bounds));
  });

  await run("physics/runtime-world", async (page) => {
    await page.waitForFunction(() => {
      const text = document.querySelector("pre")?.textContent ?? "";
      const match = text.match(
        /^Tick (\d+); bodies (\d+); ball (.+); velocity /u,
      );
      return (
        match &&
        Number(match[1]) > 0 &&
        Number(match[2]) >= 2 &&
        match[3] !== "pending"
      );
    });
    const status = await page.locator("pre").textContent();
    assert.match(status, /^Tick [1-9]\d*; bodies [2-9]\d*; ball /u);
  });
} finally {
  await browser.close();
}
