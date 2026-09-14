import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { chromium } from "playwright";

const workspaceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const previewOutputDirectory = resolve(
  workspaceRoot,
  process.env.CRC_STUDIO_DOCS_PREVIEW_OUTPUT_DIRECTORY ?? "playground/dist",
);
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

async function open(page, hash, query = "") {
  await page.goto(`${origin}/${query}${hash}`);
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

  const examplesDisclosure = page.locator(
    "[data-navigation-id='examples'][aria-expanded]",
  );
  await examplesDisclosure.focus();
  await examplesDisclosure.click();
  const focusedDisclosure = await page.evaluate(
    () => document.activeElement?.getAttribute("data-navigation-id"),
  );
  if (focusedDisclosure !== "examples") {
    throw failure(
      "#/api/types/events",
      "a rerendered disclosure to retain visible keyboard focus",
      String(focusedDisclosure),
    );
  }
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
  const directAnchorFocus = await page.evaluate(
    () => ({
      id: document.activeElement?.id,
      tabindex: document.activeElement?.getAttribute("tabindex"),
    }),
  );
  if (
    directAnchorFocus.id !== "crcpointerevent" ||
    directAnchorFocus.tabindex !== "-1"
  ) {
    throw failure(
      "#/api/types/events#crcpointerevent",
      "direct anchored documentation navigation to focus the exact type target",
      JSON.stringify(directAnchorFocus),
    );
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

  await page.getByRole("button", { name: "Search documentation" }).first().click();
  await page.locator("[data-search-input]").fill("CRCPointerEvent");
  await dialog.getByRole("status").getByText("results found", { exact: false }).waitFor({ timeout: 30_000 });
  const typeResult = page.locator("[role='option']").first();
  const typeResultUrl = await typeResult.getAttribute("data-search-url");
  if (typeResultUrl !== "#/api/types/events#crcpointerevent") {
    throw failure(route, "exact CRCPointerEvent type search destination", String(typeResultUrl));
  }
  await page.locator("[data-search-input]").press("ArrowDown");
  await page.locator("[data-search-input]").press("Enter");
  await page.locator("#studio-main #crcpointerevent").waitFor({ timeout: 30_000 });
  const searchAnchorFocus = await page.evaluate(
    () => document.activeElement?.id,
  );
  if (searchAnchorFocus !== "crcpointerevent") {
    throw failure(route, "search navigation to focus the exact type anchor", String(searchAnchorFocus));
  }
}

async function searchRetryContract(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const route = "#/learn";
  try {
    await open(page, route, "?crcStudioSearchRetry=1");
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

const diagramEditorRootRoute = "#/learn/tutorials/diagram-editor";
const diagramEditorChapters = [
  ["canvas-scene", "Create the Canvas scene"],
  ["first-node", "Draw the first node"],
  ["connect-nodes", "Connect two nodes"],
  ["reusable-node", "Extract a reusable node component"],
  ["editor-chrome", "Build the editor chrome"],
  ["selection", "Select nodes with state"],
  ["dragging", "Drag nodes safely"],
  ["pan-and-zoom", "Pan and zoom the workspace"],
  ["viewport-and-layer", "Constrain the viewport"],
  ["filters", "Polish selection with filters"],
  ["keyboard-interaction", "Add keyboard interaction"],
  ["finished-editor", "Finish and harden the editor"],
];

function diagramEditorChapterRoute(slug) {
  return `${diagramEditorRootRoute}/${slug}`;
}

async function tutorialWorkbenchContract(page, route) {
  await page
    .locator("#studio-main")
    .getByText("Live · changes run automatically", { exact: true })
    .waitFor({ timeout: 30_000 });
  const frames = page.locator("#studio-main .studio-preview__frame");
  const count = await frames.count();
  const sandbox = await frames.first().getAttribute("sandbox");
  if (count !== 1 || sandbox !== "allow-scripts") {
    throw failure(
      route,
      "one script-only tutorial preview frame",
      `${count} frames; sandbox=${sandbox}`,
    );
  }
}

async function diagramEditorLandingContract(page) {
  const route = diagramEditorRootRoute;
  await open(page, route);
  await expectMainHeading(page, route, "Learn the basics: Build a diagram editor");
  const teaser = page.locator(
    "#studio-main img[src$='/tutorials/diagram-editor/finished-editor.png']",
  );
  const curriculum = page.locator("#studio-main").getByRole("heading", {
    name: "Curriculum",
    exact: true,
  });
  await teaser.waitFor({ timeout: 30_000 });
  await curriculum.waitFor({ timeout: 30_000 });
  const [teaserPosition, curriculumPosition] = await Promise.all([
    teaser.evaluate((element) =>
      [...document.querySelectorAll("#studio-main *")].indexOf(element),
    ),
    curriculum.evaluate((element) =>
      [...document.querySelectorAll("#studio-main *")].indexOf(element),
    ),
  ]);
  if (teaserPosition >= curriculumPosition) {
    throw failure(
      route,
      "the final editor teaser before the Curriculum heading",
      `teaser index=${teaserPosition}; curriculum index=${curriculumPosition}`,
    );
  }

  await page.getByRole("link", { name: /start building/i }).click();
  if (!page.url().endsWith(diagramEditorChapterRoute(diagramEditorChapters[0][0]))) {
    throw failure(route, "Start building to open Chapter 1", page.url());
  }
  await expectMainHeading(page, diagramEditorChapterRoute(diagramEditorChapters[0][0]), diagramEditorChapters[0][1]);

  await open(page, route);
  await page.getByRole("link", { name: /open the finished editor/i }).click();
  if (!page.url().endsWith(diagramEditorChapterRoute(diagramEditorChapters.at(-1)[0]))) {
    throw failure(route, "Open the finished editor to open Chapter 12", page.url());
  }
  await expectMainHeading(page, diagramEditorChapterRoute(diagramEditorChapters.at(-1)[0]), diagramEditorChapters.at(-1)[1]);
}

async function diagramEditorChapterContract(page) {
  for (const [index, [slug, title]] of diagramEditorChapters.entries()) {
    const chapter = index + 1;
    const route = diagramEditorChapterRoute(slug);
    await open(page, route);
    await expectMainHeading(page, route, title);
    await tutorialWorkbenchContract(page, route);

    const pagination = page.locator("#studio-main .tutorial-pagination");
    const previous = pagination.locator("[data-tutorial-direction='previous']");
    const next = pagination.locator("[data-tutorial-direction='next']");
    const previousCount = await previous.count();
    const nextCount = await next.count();
    if (previousCount !== 1 || nextCount !== 1) {
      throw failure(
        route,
        `one previous and one next pagination action for Chapter ${chapter}`,
        `${previousCount} previous; ${nextCount} next`,
      );
    }

    const expectedPreviousRoute =
      chapter === 1
        ? diagramEditorRootRoute
        : diagramEditorChapterRoute(diagramEditorChapters[index - 1][0]);
    const expectedPreviousTitle =
      chapter === 1
        ? "Learn the basics: Build a diagram editor"
        : diagramEditorChapters[index - 1][1];
    const previousHref = await previous.getAttribute("href");
    const previousLabel = await previous.textContent();
    if (
      previousHref !== expectedPreviousRoute ||
      previousLabel?.trim() !== `Previous: ${expectedPreviousTitle}`
    ) {
      throw failure(
        route,
        `Chapter ${chapter} previous pagination ${JSON.stringify({ href: expectedPreviousRoute, label: `Previous: ${expectedPreviousTitle}` })}`,
        JSON.stringify({ href: previousHref, label: previousLabel?.trim() }),
      );
    }

    const nextHref = await next.getAttribute("href");
    const nextLabel = await next.textContent();
    if (chapter === diagramEditorChapters.length) {
      if (nextHref !== diagramEditorRootRoute || nextLabel?.trim() !== "Back to the tutorial overview") {
        throw failure(
          route,
          "Chapter 12 to offer only Back to the tutorial overview",
          JSON.stringify({ href: nextHref, label: nextLabel?.trim() }),
        );
      }
    } else {
      const expectedNextRoute = diagramEditorChapterRoute(diagramEditorChapters[index + 1][0]);
      const expectedNextLabel = `Next: ${diagramEditorChapters[index + 1][1]}`;
      if (nextHref !== expectedNextRoute || nextLabel?.trim() !== expectedNextLabel) {
        throw failure(
          route,
          `Chapter ${chapter} next pagination ${JSON.stringify({ href: expectedNextRoute, label: expectedNextLabel })}`,
          JSON.stringify({ href: nextHref, label: nextLabel?.trim() }),
        );
      }
    }

    if (chapter === 6 || chapter === 12) {
      await page.getByRole("button", { name: "Reset", exact: true }).click();
      await page.getByRole("button", { name: "Share", exact: true }).click();
      await page
        .locator("#studio-main .studio-run-status")
        .getByText("Share URL copied.", { exact: true })
        .waitFor({ timeout: 30_000 });
    }
  }
}

async function diagramEditorTeardownContract(page) {
  const route = diagramEditorChapterRoute(diagramEditorChapters.at(-1)[0]);
  await open(page, route);
  await tutorialWorkbenchContract(page, route);
  await page.evaluate(() => {
    window.location.hash = "#/learn/guides/author-without-jsx";
  });
  await page.locator("#studio-main iframe").waitFor({ state: "detached", timeout: 30_000 });
  await page.locator("#studio-main .monaco-editor").waitFor({ state: "detached", timeout: 30_000 });
  await expectMainHeading(page, "#/learn/guides/author-without-jsx", "Author without JSX");
}

async function diagramEditorNarrowLayoutContract(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const assertFits = async (route, selector, description) => {
    const box = await page.locator(selector).boundingBox();
    if (box === null || box.x < 0 || box.x + box.width > 390) {
      throw failure(route, `${description} to fit the narrow viewport`, JSON.stringify(box));
    }
  };
  const assertPageHasNoOverflow = async (route) => {
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    if (dimensions.scrollWidth > dimensions.clientWidth) {
      throw failure(route, "no horizontal page overflow", JSON.stringify(dimensions));
    }
  };
  try {
    await open(page, diagramEditorRootRoute);
    await assertFits(
      diagramEditorRootRoute,
      "#studio-main img[src$='/tutorials/diagram-editor/finished-editor.png']",
      "the tutorial teaser",
    );
    await assertPageHasNoOverflow(diagramEditorRootRoute);

    const middleRoute = diagramEditorChapterRoute(diagramEditorChapters[5][0]);
    await open(page, middleRoute);
    await tutorialWorkbenchContract(page, middleRoute);
    await assertFits(middleRoute, "#studio-main .studio-tools", "the workbench tools");
    await assertFits(middleRoute, "#studio-main .tutorial-pagination", "tutorial pagination");
    await assertPageHasNoOverflow(middleRoute);
  } finally {
    await context.close();
  }
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
    "--outDir",
    previewOutputDirectory,
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
  await diagramEditorLandingContract(page);
  await diagramEditorChapterContract(page);
  await diagramEditorTeardownContract(page);
  await diagramEditorNarrowLayoutContract(browser);
  await context.close();
  process.stdout.write("Validated CRC Studio public documentation navigation and search acceptance.\n");
} catch (error) {
  if (serverOutput) process.stderr.write(serverOutput);
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
