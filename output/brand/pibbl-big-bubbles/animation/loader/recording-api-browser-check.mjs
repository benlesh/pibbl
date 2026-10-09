import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let acquired = 0,
  released = 0;
page.on("worker", (worker) => {
  acquired++;
  worker.on("close", () => released++);
});
try {
  await page.goto("http://127.0.0.1:8766/canvas-comparison.html");
  await page.waitForFunction(() => !!window.captureUI);
  await page
    .getByRole("button", { name: "Record 11 seconds", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-record=status]")
        .textContent.includes("GIF ready"),
    null,
    { timeout: 90000 },
  );
  const fullStatus = await page.locator("[data-record=status]").textContent();
  const output = await page.evaluate(async () => {
    const blob = await (
      await fetch(document.querySelector("[data-record=download]").href)
    ).blob();
    const decoder = new ImageDecoder({
      data: await blob.arrayBuffer(),
      type: "image/gif",
    });
    await decoder.tracks.ready;
    let duration = 0;
    const count = decoder.tracks.selectedTrack.frameCount;
    for (let i = 0; i < count; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      duration += image.duration / 1000;
      image.close();
    }
    decoder.close();
    return { gifBytes: blob.size, frames: count, duration };
  });
  await page.waitForFunction(
    () => document.querySelector("[data-record=preview]").complete,
  );
  await page.screenshot({
    path: "/tmp/pibbl-recording-full.png",
    fullPage: true,
  });
  await page.waitForTimeout(50);
  if (page.workers().length)
    throw new Error("Worker survived completed UI export");
  for (let i = 0; i < 10; i++) {
    await page
      .getByRole("button", { name: "Record 11 seconds", exact: true })
      .click();
    if (i % 2) {
      await page.waitForFunction(() =>
        document
          .querySelector("[data-record=status]")
          .textContent.includes("Recording…"),
      );
    }
    await page
      .getByRole("button", {
        name: "Discard recording / cancel export",
        exact: true,
      })
      .click();
    await page.waitForTimeout(30);
    if (page.workers().length) throw new Error("Worker survived discard " + i);
  }
  await page
    .getByRole("button", { name: "Record 11 seconds", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector("[data-record=status]")
      .textContent.includes("Recording…"),
  );
  await page.waitForTimeout(300);
  await page
    .getByRole("button", { name: "Stop and make GIF", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector("[data-record=status]")
      .textContent.includes("Encoding"),
  );
  await page
    .getByRole("button", {
      name: "Discard recording / cancel export",
      exact: true,
    })
    .click();
  await page.waitForTimeout(50);
  if (page.workers().length) throw new Error("Worker survived export discard");
  await page
    .getByRole("button", { name: "Record 11 seconds", exact: true })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector("[data-record=status]")
      .textContent.includes("Recording…"),
  );
  await page.getByRole("button", { name: "Dispose", exact: true }).click();
  await page.waitForTimeout(80);
  if (page.workers().length) throw new Error("Worker survived mount disposal");
  const report = {
    fullStatus,
    output,
    acquired,
    released,
    liveWorkers: page.workers().length,
    errors,
    userAgent: await page.evaluate(() => navigator.userAgent),
  };
  await writeFile(
    "/tmp/pibbl-recording-qa.json",
    JSON.stringify(report, null, 2),
  );
  process.stdout.write(JSON.stringify(report) + "\n");
  if (errors.length || acquired !== released || output.duration !== 11000)
    process.exitCode = 1;
} finally {
  await browser.close();
}
