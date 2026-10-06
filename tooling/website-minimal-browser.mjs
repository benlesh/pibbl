import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PIBBL_WEBSITE_URL ?? "http://localhost:4321";
const families = process.argv.slice(2);
const examples = JSON.parse(
  await readFile(
    new URL(
      "../website/public/generated/minimal-examples.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  let errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const example of examples.filter(
    (example) =>
      example.environment === "browser" &&
      (!families.length || families.includes(example.id.split("/")[0])),
  )) {
    errors = [];
    const response = await page.goto(
      `${base}/minimal-runtime/${example.id}.html`,
    );
    assert.equal(response.status(), 200, example.id);
    await page.waitForFunction(
      () =>
        document.body.dataset.exampleReady ||
        document.body.dataset.exampleError,
    );
    assert.equal(
      await page.getAttribute("body", "data-example-error"),
      null,
      example.id,
    );
    await page.waitForTimeout(500);
    if (example.id === "text/outline") {
      await page.waitForFunction(() =>
        document.querySelector("p")?.textContent?.startsWith("9 glyphs;"),
      );
    }
    assert.deepEqual(errors, [], example.id);
    const meaningful = await page.evaluate(() => {
      const text = [...document.body.children]
        .filter((node) => node.tagName !== "SCRIPT")
        .map((node) => node.textContent)
        .join("")
        .trim();
      const painted = [...document.querySelectorAll("canvas")].some(
        (canvas) => {
          const context = canvas.getContext("2d");
          if (!context) return true;
          const data = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          ).data;
          for (let i = 3; i < data.length; i += 4) if (data[i]) return true;
          return false;
        },
      );
      return document.querySelector("canvas") ? painted : Boolean(text);
    });
    assert.ok(meaningful, `${example.id} has no rendered result`);
    const scalePositions = {
      "viz/log-scale": [0, 430 / 3, 860 / 3, 430],
      "viz/symlog-scale": [
        0,
        215 - (215 * Math.log(2)) / Math.log(11),
        215,
        215 + (215 * Math.log(2)) / Math.log(11),
        430,
      ],
      "viz/point-scale": [430 / 6, 215, (430 * 5) / 6],
    }[example.id];
    if (scalePositions) {
      const pixels = await page
        .locator("canvas")
        .evaluate((canvas, positions) => {
          const context = canvas.getContext("2d");
          return positions.map((x) => [
            ...context.getImageData(Math.round(65 + x), 110, 1, 1).data,
          ]);
        }, scalePositions);
      for (const pixel of pixels)
        assert.deepEqual(
          pixel,
          [8, 127, 140, 255],
          `${example.id}: mapped mark position`,
        );
    }
    if (example.id === "particles/system") {
      await page.getByRole("button", { name: "Burst" }).click();
      await page.waitForFunction(() =>
        document.querySelector("p")?.textContent?.includes("burst-accepted"),
      );
    }
    if (example.id === "particles/flow") {
      await page.waitForTimeout(2000);
      const spread = await page.locator("canvas").evaluate((canvas) => {
        const { width, height } = canvas;
        const pixels = canvas
          .getContext("2d")
          .getImageData(0, 0, width, height).data;
        let left = width;
        let right = -1;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            if (pixels[(y * width + x) * 4 + 3] < 16) continue;
            left = Math.min(left, x);
            right = Math.max(right, x);
          }
        }
        return right - left + 1;
      });
      assert.ok(spread > 40, "particles/flow has no sustained plume spread");
    }
    if (example.id === "lifecycle/signals") {
      await page.getByRole("button").click();
      assert.match(
        await page.locator("pre").innerText(),
        /Count: 3; doubled: 6/,
      );
    }
    if (example.id === "lifecycle/html") {
      await page.getByRole("button", { name: "Native clicks: 0" }).click();
      await page.getByRole("button", { name: "Native clicks: 1" }).waitFor();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Native clicks: 2" }).waitFor();
    }
    if (example.id === "animation/tween") {
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.waitForTimeout(100);
      const paused = await page
        .locator("canvas")
        .evaluate((canvas) => canvas.toDataURL());
      await page.waitForTimeout(150);
      assert.equal(
        await page.locator("canvas").evaluate((canvas) => canvas.toDataURL()),
        paused,
      );
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await page.waitForTimeout(150);
      assert.notEqual(
        await page.locator("canvas").evaluate((canvas) => canvas.toDataURL()),
        paused,
      );
    }
    if (
      example.id.startsWith("transitions/") &&
      example.id !== "transitions/custom"
    ) {
      await page.getByRole("button", { name: "hide", exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector("output")?.textContent === "exit: finished",
      );
      await page.getByRole("button", { name: "show", exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector("output")?.textContent === "enter: finished",
      );
    }
    if (example.id === "manipulation/controller") {
      const bounds = await page.locator("canvas").boundingBox();
      await page.mouse.move(bounds.x + 120, bounds.y + 100);
      await page.mouse.down();
      await page.mouse.move(bounds.x + 150, bounds.y + 115, { steps: 4 });
      await page.mouse.up();
      await page.waitForFunction(() =>
        document.querySelector("pre")?.textContent?.includes("committed=true"),
      );
    }
    if (example.id === "text/outline") {
      await page.waitForFunction(() =>
        document.querySelector("p")?.textContent?.startsWith("9 glyphs;"),
      );
    }
    assert.deepEqual(errors, [], `${example.id} after interaction`);
    process.stdout.write(`PASS ${example.id}\n`);
  }
} finally {
  await browser.close();
}
