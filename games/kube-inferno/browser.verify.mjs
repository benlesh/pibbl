import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1672, height: 940 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5190/");
  await page.waitForFunction(() => window.kubeInferno?.snapshot().time > 1);
  const snapshot = () => page.evaluate(() => window.kubeInferno.snapshot());
  assert.equal(
    await page.getByRole("region", { name: "Quick start" }).isVisible(),
    true,
  );
  await page.screenshot({
    path: "/tmp/kube-inferno-guide.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Next tip →", exact: true }).click();
  assert.equal(
    await page.getByLabel("Select a machine", { exact: true }).inputValue(),
    "app-3",
  );
  assert.equal(
    await page
      .getByText("Sparks mean it’s offline.", { exact: true })
      .isVisible(),
    true,
  );
  await page.getByRole("button", { name: "Next tip →", exact: true }).click();
  assert.equal(
    await page
      .getByText("Build. Connect. Let it boot.", { exact: true })
      .isVisible(),
    true,
  );
  await page.getByRole("button", { name: "Let me try", exact: true }).click();
  await page.reload();
  await page.waitForFunction(() => window.kubeInferno?.snapshot().time > 1);
  assert.equal(
    await page.getByRole("region", { name: "Quick start" }).isVisible(),
    false,
  );
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  const initial = await snapshot();
  assert.ok(initial.nodes.find((n) => n.id === "app-2").load > 1);
  await page.waitForTimeout(150);
  assert.equal((await snapshot()).time, initial.time);
  assert.equal(await page.locator("nav").count(), 0);
  const map = await page.locator("canvas").boundingBox();
  await page.getByRole("button", { name: /LARGE SERVER \$600/ }).click();
  const scale = Math.min(map.width / 1200, map.height / 720);
  await page.mouse.click(
    map.x + (map.width - 1200 * scale) / 2 + (350 * 0.88 + 30) * scale,
    map.y + (map.height - 720 * scale) / 2 + (570 * 0.88 + 78) * scale,
  );
  let state = await snapshot();
  assert.equal(state.nodes.length, 7);
  assert.equal(state.bank, initial.bank - 600);
  const added = state.nodes.at(-1);
  assert.equal(added.ready, false);
  await page
    .getByLabel("Select a machine", { exact: true })
    .selectOption("gateway");
  await page.getByLabel("Connection destination").selectOption(added.id);
  await page
    .getByRole("button", { name: "Connect selected machines", exact: true })
    .click();
  await page
    .getByLabel("Select a machine", { exact: true })
    .selectOption(added.id);
  await page.getByLabel("Connection destination").selectOption("database");
  await page
    .getByRole("button", { name: "Connect selected machines", exact: true })
    .click();
  await page.screenshot({
    path: "/tmp/kube-inferno-building.png",
    fullPage: true,
  });
  state = await snapshot();
  assert.ok(state.edges.some(([a, b]) => a === "gateway" && b === added.id));
  assert.ok(state.edges.some(([a, b]) => a === added.id && b === "database"));
  await page.getByRole("button", { name: "2×", exact: true }).click();
  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  await page.waitForFunction(
    (id) => window.kubeInferno.snapshot().nodes.find((n) => n.id === id).ready,
    added.id,
    { timeout: 25000 },
  );
  await page.waitForFunction(
    () => window.kubeInferno.snapshot().quality > 0.9,
    { timeout: 6000 },
  );
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  state = await snapshot();
  assert.ok(state.nodes.find((n) => n.id === "app-2").load < 1);
  await page.getByRole("button", { name: /Retire component/ }).click();
  assert.equal((await snapshot()).nodes.length, 6);
  await page.getByRole("button", { name: "New run ↗", exact: true }).click();
  await page.waitForFunction(() => window.kubeInferno.snapshot().time > 2);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await page.screenshot({
    path: "/tmp/kube-inferno-desktop.png",
    fullPage: true,
  });
  // Pointer geometry must agree with the aspect-preserving canvas fit after resize.
  for (const viewport of [
    { width: 1000, height: 720 },
    { width: 780, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const rect = await page.locator("canvas").boundingBox();
    const fit = Math.min(rect.width / 1200, rect.height / 720);
    const at = (x, y) => ({
      x: rect.x + (rect.width - 1200 * fit) / 2 + (x * 0.88 + 30) * fit,
      y: rect.y + (rect.height - 720 * fit) / 2 + (y * 0.88 + 78) * fit,
    });
    const start = at(510, 355 - 60);
    await page.mouse.click(start.x, start.y);
    assert.equal(
      await page.getByLabel("Select a machine", { exact: true }).inputValue(),
      "app-2",
    );
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 30, start.y + 15, { steps: 5 });
    await page.mouse.up();
    const moved = (await snapshot()).nodes.find((n) => n.id === "app-2");
    assert.ok(Math.abs(moved.x - (510 + 30 / (fit * 0.88))) < 2);
    assert.ok(Math.abs(moved.y - (355 + 15 / (fit * 0.88))) < 2);
    await page.mouse.move(start.x + 30, start.y + 15);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y, { steps: 5 });
    await page.mouse.up();
    const restored = (await snapshot()).nodes.find((n) => n.id === "app-2");
    assert.ok(Math.abs(restored.x - 510) < 2 && Math.abs(restored.y - 355) < 2);
    // Reconnect a real route by clicking its two on-canvas ports.
    await page.getByLabel("Connection destination").selectOption("database");
    await page
      .getByRole("button", { name: "Disconnect selected route", exact: true })
      .click();
    const from = at(510 + 75, 355 - 8),
      to = at(980 - 75, 275 - 8);
    await page.mouse.click(from.x, from.y);
    await page.mouse.click(to.x, to.y);
    assert.ok(
      (await snapshot()).edges.some(
        ([a, b]) => a === "app-2" && b === "database",
      ),
    );
    await page.locator(".inspector").evaluate((el) => {
      el.scrollTop = 0;
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `/tmp/kube-inferno-resize-${viewport.width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  assert.equal(await page.locator("dialog").evaluate((d) => d.open), true);
  await page
    .getByRole("button", { name: "Keep the lights on →", exact: true })
    .click();
  await page.screenshot({
    path: "/tmp/kube-inferno-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await page
    .getByRole("button", { name: "Replay quick tips", exact: true })
    .click();
  assert.equal(
    await page.getByRole("region", { name: "Quick start" }).isVisible(),
    true,
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "/tmp/kube-inferno-guide-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Skip tips", exact: true }).click();
  await page.reload();
  await page.waitForFunction(() => window.kubeInferno?.snapshot().time > 0);
  assert.equal(
    await page.getByRole("region", { name: "Quick start" }).isVisible(),
    false,
  );
  assert.deepEqual(errors, []);
  process.stdout.write(
    "PASS: standalone navigation boundary, pause, purchase accounting, routing, construction, recovery, retirement, restart, resize selection/drag/port connections, mobile width, instructions, three-step first-run guide, replay, completion and skip persistence; no browser errors.",
  );
} finally {
  await browser.close();
}
