import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 850 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4381/pibbl");
  await page.waitForTimeout(5000);
  const proof = await page.evaluate(() => window.productionProof?.());
  console.warn(JSON.stringify({ errors, proof }));
  if (!proof || proof.disturbances < 30 || proof.materialDetail === 0.2)
    throw new Error("Animation or physics integration did not advance");
  await page.screenshot({ path: "/private/tmp/pibbl-wasm-production.png" });
  await page.getByLabel("Pause reaction", { exact: true }).check();
  await page.getByRole("button", { name: "Reset scene" }).click();
  if (await page.getByLabel("Pause reaction", { exact: true }).isChecked())
    throw new Error("Reset left pause enabled");
  if (errors.length) throw new Error(errors.join("\n"));
  await page.setViewportSize({ width: 390, height: 850 });
  await page.screenshot({
    path: "/private/tmp/pibbl-wasm-production-mobile.png",
  });
} finally {
  await browser.close();
}
