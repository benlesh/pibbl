import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.CRC_WEBSITE_URL ?? "http://localhost:4321";
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
      return Boolean(text || painted);
    });
    assert.ok(meaningful, `${example.id} has no rendered result`);
    process.stdout.write(`PASS ${example.id}\n`);
  }
} finally {
  await browser.close();
}
