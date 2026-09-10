import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { chromium } from "playwright";

const workspaceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const previewPort = process.env.CRC_STUDIO_DOCS_PREVIEW_PORT ?? "4175";
if (!/^[1-9]\d{0,4}$/.test(previewPort) || Number(previewPort) > 65_535) {
  throw new Error(
    `CRC_STUDIO_DOCS_PREVIEW_PORT must be an integer from 1 through 65535; received ${JSON.stringify(previewPort)}.`,
  );
}
const origin = `http://127.0.0.1:${previewPort}`;

function failure(route, expectation, actual) {
  return new Error(
    `[${route}] Expected ${expectation}; received ${actual}.`,
  );
}

async function waitForServer(process) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (process.exitCode !== null) {
      throw new Error(`Studio preview server exited with code ${process.exitCode}.`);
    }
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The preview server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error("Timed out waiting for the Studio preview server.");
}

async function open(page, hash) {
  await page.goto(`${origin}/${hash}`);
  await page.locator("#studio-main").waitFor({ timeout: 30_000 });
}

async function expectMainHeading(page, route, text) {
  try {
    await page
      .locator("#studio-main")
      .getByRole("heading", { name: text, exact: true })
      .waitFor({ timeout: 30_000 });
  } catch {
    throw failure(route, `main-page heading ${JSON.stringify(text)}`, "it was not rendered");
  }
}

async function navigationContract(page) {
  const route = "#/learn";
  await open(page, route);
  await expectMainHeading(page, route, "Learn CRC");
  const publicAreas = await page.locator(
    ".studio-nav__area > .studio-nav__entry > a",
  ).allTextContents();
  assert.deepEqual(
    publicAreas.map((label) => label.trim()),
    ["Learn", "API", "Examples"],
    failure(route, "public navigation order Learn, API, Examples", JSON.stringify(publicAreas)),
  );
  const navText = await page.locator("nav.studio-nav").textContent();
  assert.equal(
    navText?.includes("Automated test labs"),
    false,
    failure(route, "Test Labs outside the public navigation tree", JSON.stringify(navText)),
  );

  await page.evaluate(() => {
    localStorage.setItem(
      "crc-studio-navigation:v1",
      JSON.stringify({ api: false, "api-types": false }),
    );
  });
  await open(page, "#/api/types/events");
  for (const id of ["api", "api-types"]) {
    await assertExpanded(page, "#/api/types/events", id, true);
  }
  await assertExpanded(page, "#/api/types/events", "examples", false);

  await page.locator("[data-navigation-id='examples'][aria-expanded]").click();
  await assertExpanded(page, "#/api/types/events", "examples", true);
  await page.reload();
  await assertExpanded(page, "#/api/types/events", "examples", true);
}

async function assertExpanded(page, route, id, expanded) {
  const actual = await page
    .locator(`[data-navigation-id='${id}'][aria-expanded]`)
    .getAttribute("aria-expanded");
  if (actual !== String(expanded)) {
    throw failure(route, `${id} expanded=${expanded}`, `${id} expanded=${actual}`);
  }
}

async function mobileDrawerContract(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const route = "#/learn";
  try {
    await open(page, route);
    const menu = page.getByRole("button", { name: /browse/i });
    await menu.click();
    const drawer = page.locator("#studio-navigation[role='dialog'][aria-modal='true']");
    await drawer.waitFor();
    await page.keyboard.press("Shift+Tab");
    const focusedClass = await page.evaluate(() => document.activeElement?.className);
    if (focusedClass !== "studio-testing-link") {
      throw failure(route, "mobile drawer focus to wrap to its final destination", String(focusedClass));
    }
    await page.keyboard.press("Escape");
    const drawerRole = await page.locator("#studio-navigation").getAttribute("role");
    if (drawerRole !== null) {
      throw failure(route, "Escape to close the mobile drawer", `role=${drawerRole}`);
    }
    const focusedMenu = await page.evaluate(() => document.activeElement?.className);
    if (focusedMenu !== "studio-menu-button") {
      throw failure(route, "Escape to restore focus to Browse", String(focusedMenu));
    }
    await menu.click();
    await page.locator(".studio-drawer-close").click();
    const afterClose = await page.evaluate(() => document.activeElement?.className);
    if (afterClose !== "studio-menu-button") {
      throw failure(route, "drawer close button to restore focus to Browse", String(afterClose));
    }
  } finally {
    await context.close();
  }
}

async function publicContentContract(page) {
  await open(page, "#/learn/guides/compose-and-layout#filters-across-layout-and-composition");
  const guideRoute = "#/learn/guides/compose-and-layout#filters-across-layout-and-composition";
  await expectMainHeading(page, guideRoute, "Compose and lay out scenes");
  const anchor = page.locator("#studio-main #filters-across-layout-and-composition");
  if ((await anchor.count()) !== 1) {
    throw failure(guideRoute, "one generated heading anchor", `${await anchor.count()} anchors`);
  }

  await open(page, "#/api/functions/crc");
  await expectMainHeading(page, "#/api/functions/crc", "crc");
  await open(page, "#/api/types/events#crcpointerevent");
  const typeAnchor = page.locator("#studio-main #crcpointerevent");
  if ((await typeAnchor.count()) !== 1) {
    throw failure("#/api/types/events#crcpointerevent", "the CRCPointerEvent type anchor", `${await typeAnchor.count()} anchors`);
  }

  await open(page, "#/examples/drawing/filters");
  await page.locator(".studio-preview__frame").waitFor({ timeout: 30_000 });
  const drawing = page.locator(".studio-nav__group", { hasText: "Drawing" });
  const drawingLinks = await drawing.locator("a").allTextContents();
  const normalized = drawingLinks.map((label) => label.trim());
  if (!normalized.includes("Filters")) {
    throw failure("#/examples/drawing/filters", "Filters under Drawing", JSON.stringify(normalized));
  }
  const alphabetical = [...normalized].sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
  assert.deepEqual(
    normalized,
    alphabetical,
    failure("#/examples/drawing/filters", "alphabetical Drawing example links", JSON.stringify(normalized)),
  );
}

async function redirectContract(page) {
  await open(page, "#/examples/composition/filters?code=v1.abc");
  if (!page.url().endsWith("#/examples/drawing/filters?code=v1.abc")) {
    throw failure("#/examples/composition/filters?code=v1.abc", "canonical Drawing route with share query", page.url());
  }
  await open(page, "#/scenarios/baseline-smoke?inspect=1");
  if (!page.url().endsWith("#/testing/baseline-smoke?inspect=1")) {
    throw failure("#/scenarios/baseline-smoke?inspect=1", "canonical test-lab route with query", page.url());
  }
}

async function searchContract(page) {
  const route = "#/api";
  await open(page, route);
  const before = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  if (before.some((url) => /search-dialog|crc-studio-search/u.test(url))) {
    throw failure(route, "search code absent before search intent", JSON.stringify(before.filter((url) => /search/u.test(url))));
  }
  const trigger = page.getByRole("button", { name: "Search documentation" }).first();
  await trigger.focus();
  const dialog = page.locator(".studio-search-dialog");
  await dialog.waitFor({ state: "attached", timeout: 30_000 });
  if (await dialog.evaluate((element) => element.open)) {
    throw failure(route, "preload intent to leave search dialog closed", "dialog was already open");
  }
  await trigger.click();
  await page.locator(".studio-search-dialog[open]").waitFor({ timeout: 30_000 });
  await page.locator("[data-search-input]").fill("crcState");
  await dialog.getByRole("status").getByText("results found", { exact: false }).waitFor({ timeout: 30_000 });
  const firstResult = page.locator("[role='option']").first();
  const firstTitle = (await firstResult.locator("strong").textContent())?.trim();
  if (firstTitle !== "crcState") {
    throw failure(route, "exact crcState symbol ranked first", JSON.stringify(firstTitle));
  }
  await page.locator("[data-search-kind='api']").click();
  const selected = await page.locator("[data-search-kind='api']").getAttribute("aria-pressed");
  if (selected !== "false") {
    throw failure(route, "API category filter toggle", `aria-pressed=${selected}`);
  }
  await page.locator("[data-search-kind='api']").click();
  const resultUrls = await page.locator("[role='option']").evaluateAll(
    (options) => options.map((option) => option.getAttribute("data-search-url")),
  );
  const resultContents = await page.locator("[role='option']").allTextContents();
  if (
    resultUrls.length === 0 ||
    resultUrls.some((url) => url === null || url.startsWith("#/testing")) ||
    resultContents.some((content) => /testing|test lab|scenario/u.test(content))
  ) {
    throw failure(
      route,
      "public search results with no test-lab route or record",
      JSON.stringify({ resultUrls, resultContents }),
    );
  }
  await page.locator("[data-search-input]").press("ArrowDown");
  await page.locator("[data-search-input]").press("Enter");
  await page.locator(".studio-search-dialog").waitFor({ state: "hidden" });
  if (!page.url().endsWith("#/api/hooks/crc-state")) {
    throw failure(route, "keyboard activation to crcState API route", page.url());
  }

  await page.getByRole("button", { name: "Search documentation" }).first().click();
  await page.locator("[data-search-input]").fill("qzvxylmnop");
  await dialog.getByRole("status").getByText("No results", { exact: false }).waitFor({ timeout: 30_000 });
  await page.keyboard.press("Escape");
  const after = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  if (!after.some((url) => /search-dialog|crc-studio-search/u.test(url))) {
    throw failure(route, "search code loaded after focus intent", JSON.stringify(after.filter((url) => /search/u.test(url))));
  }
}

async function searchRetryContract(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const route = "#/learn";
  try {
    await page.addInitScript(() => {
      window.__CRC_STUDIO_ACCEPTANCE_FAIL_SEARCH_ONCE__ = true;
    });
    await open(page, route);
    await page
      .getByRole("button", { name: "Search documentation" })
      .first()
      .dispatchEvent("click");
    const dialog = page.locator(".studio-search-dialog[open]");
    await dialog.waitFor({ timeout: 30_000 });
    await dialog.getByRole("status").getByText("Search unavailable", { exact: false }).waitFor({ timeout: 30_000 });
    const retry = dialog.locator("[data-search-retry]");
    await retry.waitFor({ timeout: 30_000 });
    await retry.click();
    await page.locator("[data-search-input]").fill("crcState");
    await dialog.getByRole("status").getByText("results found", { exact: false }).waitFor({ timeout: 30_000 });
    const failureFlag = await page.evaluate(
      () => window.__CRC_STUDIO_ACCEPTANCE_FAIL_SEARCH_ONCE__,
    );
    if (failureFlag !== false) {
      throw failure(route, "the one-shot acceptance loader failure to be consumed", String(failureFlag));
    }
  } finally {
    await context.close();
  }
}

async function existingStudioContract(page) {
  const route = "#/examples/drawing/rectangle";
  await open(page, route);
  await page
    .locator("#studio-main")
    .getByText("Live · changes run automatically", { exact: true })
    .waitFor({ timeout: 30_000 });
  const frames = page.locator(".studio-preview__frame");
  const count = await frames.count();
  const sandbox = await frames.first().getAttribute("sandbox");
  if (count !== 1 || sandbox !== "allow-scripts") {
    throw failure(route, "one script-only live frame", `${count} frames; sandbox=${sandbox}`);
  }
  await page.getByRole("button", { name: "Reset" }).waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "Share" }).waitFor({ timeout: 30_000 });

  await open(page, "#/testing/baseline-smoke");
  await page.locator(".scenario-runner canvas").waitFor({ timeout: 30_000 });
  await page.getByText("View exact fixture source").click();
  await page.locator(".testing-source__editor .monaco-editor").waitFor({ timeout: 30_000 });
}

const server = spawn(
  process.execPath,
  [
    resolve(workspaceRoot, "node_modules/vite/bin/vite.js"),
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    previewPort,
    "--strictPort",
  ],
  { cwd: resolve(workspaceRoot, "playground"), stdio: ["ignore", "pipe", "pipe"] },
);
let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk;
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk;
});

let browser;
try {
  await waitForServer(server);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await navigationContract(page);
  await mobileDrawerContract(browser);
  await publicContentContract(page);
  await redirectContract(page);
  await searchRetryContract(browser);
  await searchContract(page);
  await existingStudioContract(page);
  await context.close();
  process.stdout.write("Validated CRC Studio public documentation navigation and search acceptance.\n");
} catch (error) {
  if (serverOutput) process.stderr.write(serverOutput);
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
