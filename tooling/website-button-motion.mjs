import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch();
try {
  async function sample(action, reducedMotion = "no-preference") {
    const page = await browser.newPage({ reducedMotion });
    await page.clock.install({ time: new Date("2026-10-04T12:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-04T12:00:01Z"));
    await page.goto("http://localhost:4321/guides/native-button/");
    await page.clock.runFor(500);
    const button = page.getByRole("button", { name: "Try CRC" });
    const box = await button.boundingBox();
    await page.mouse.move(box.x + 12, box.y + box.height / 2);
    await page.clock.runFor(100);
    if (action === "move")
      await page.mouse.move(box.x + box.width - 12, box.y + box.height / 2, {
        steps: 12,
      });
    if (action === "click")
      await button.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await page.clock.runFor(300);
    if (action === "click" && reducedMotion === "no-preference")
      await page.screenshot({ path: "/tmp/crc-button-burst.png" });
    const pixels = await page
      .locator("#ink-canvas")
      .evaluate((c) => c.toDataURL());
    await page.close();
    return pixels;
  }
  const idle = await sample("idle");
  assert.notEqual(
    await sample("move"),
    idle,
    "moving across the button must disturb ink beyond hover",
  );
  assert.notEqual(await sample("click"), idle, "activation must disturb ink");
  assert.equal(
    await sample("move", "reduce"),
    await sample("idle", "reduce"),
    "reduced motion suppresses pointer disturbance",
  );
  process.stdout.write(
    "PASS: pointer movement and clicks change ink; reduced motion suppresses disturbance.\n",
  );
} finally {
  await browser.close();
}
