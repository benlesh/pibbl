import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const output = new URL("../website/dist/", import.meta.url);
const base = process.env.PIBBL_WEBSITE_URL ?? "http://localhost:4321";
const catalog = JSON.parse(
  await readFile(new URL("catalog.json", output), "utf8"),
);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ javaScriptEnabled: false });
  const documents = [];
  for (const entry of catalog.entries)
    documents.push({
      url: entry.url,
      html: await readFile(new URL(`.${entry.url}index.html`, output), "utf8"),
    });
  const parsed = await page.evaluate(
    (documents) =>
      documents.map(({ url, html }) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return {
          url,
          headings: doc.querySelectorAll("h1").length,
          ids: [...doc.querySelectorAll("[id]")].map((node) => node.id),
          links: [...doc.querySelectorAll("main a[href]")].map((node) =>
            node.getAttribute("href"),
          ),
          images: [...doc.querySelectorAll("main img[src]")].map((node) =>
            node.getAttribute("src"),
          ),
          playgroundRoutes: [
            ...doc.querySelectorAll("#playground-example option"),
          ].map((node) => node.getAttribute("value")),
        };
      }),
    documents,
  );
  const byURL = new Map(parsed.map((doc) => [doc.url, doc]));
  const broken = [];
  for (const doc of parsed) {
    assert.equal(doc.headings, 1, doc.url);
    for (const href of doc.links) {
      const target = new URL(href, `${base}${doc.url}`);
      if (target.origin !== base) continue;
      if (target.pathname === "/playground/" && target.hash.startsWith("#/")) {
        const route = target.hash.split("?")[0];
        const routes = byURL.get("/playground/").playgroundRoutes;
        const valid =
          routes.includes(route) ||
          (route.startsWith("#/workbench/") &&
            routes.some(
              (candidate) =>
                candidate.split("/").at(-1) === route.split("/").at(-1),
            ));
        if (!valid)
          broken.push(`${doc.url} -> unknown playground route ${href}`);
        continue;
      }
      if (
        target.hash &&
        byURL.has(target.pathname) &&
        !byURL
          .get(target.pathname)
          .ids.includes(decodeURIComponent(target.hash.slice(1)))
      )
        broken.push(`${doc.url} -> ${href}`);
    }
    for (const image of doc.images.filter((src) => src.startsWith("/")))
      await readFile(new URL(`.${image}`, output));
  }
  assert.deepEqual(broken, [], "all internal heading links resolve");
  await page.goto(`${base}/reference/`);
  await page
    .getByRole("link", { name: "Drawing, layout, and effects", exact: true })
    .click();
  await page.getByRole("link", { name: "Group", exact: true }).click();
  await page
    .getByRole("link", { name: "Drawing, layout, and effects companion" })
    .click();
  await page
    .getByRole("heading", { name: "Verification", exact: true })
    .waitFor();
  const markdownLink = page.getByRole("link", {
    name: "Read as Markdown",
    exact: true,
  });
  const markdown = await page.request.get(
    new URL(await markdownLink.getAttribute("href"), base).href,
  );
  assert.equal(markdown.status(), 200);
  assert.match(await markdown.text(), /Complete source/);
  await page.goto(`${base}/minimal-examples/`);
  await page
    .getByRole("link", { name: "Tween playback controls", exact: true })
    .click();
  assert.match(await page.locator("main").innerText(), /controller.dispose/);
  await page.getByRole("link", { name: "Plain source", exact: true }).waitFor();
  await page.goto(`${base}/agents/`);
  await page.screenshot({ path: "/tmp/pibbl-agents-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/pibbl-agents-mobile.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.goto(`${base}/reference/`);
  await page.screenshot({ path: "/tmp/pibbl-reference-mobile.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const interactive = await browser.newPage();
  await interactive.goto(`${base}/minimal-examples/animation/tween/`);
  await interactive
    .locator("[data-minimal-preview] [data-run][disabled]")
    .waitFor();
  await interactive
    .frameLocator("[data-minimal-preview] iframe")
    .getByRole("button", { name: "Pause", exact: true })
    .waitFor();
  await interactive.locator("[data-minimal-preview] [data-stop]").click();
  assert.equal(
    await interactive
      .locator("[data-minimal-preview] iframe")
      .getAttribute("src"),
    "about:blank",
  );
  await interactive.locator("[data-minimal-preview] [data-run]").click();
  await interactive
    .frameLocator("[data-minimal-preview] iframe")
    .getByRole("button", { name: "Pause", exact: true })
    .waitFor();
  await interactive.goto(`${base}/experience/regular-polygon/`);
  await interactive
    .locator("[data-status]")
    .filter({ hasText: /^Running$/ })
    .waitFor();
  await interactive.getByRole("button", { name: "Stop", exact: true }).click();
  await interactive
    .locator("[data-status]")
    .filter({ hasText: /^Stopped$/ })
    .waitFor();
  await interactive
    .getByRole("button", { name: "Run example", exact: true })
    .click();
  await interactive
    .locator("[data-status]")
    .filter({ hasText: /^Running$/ })
    .waitFor();
  await interactive.emulateMedia({ reducedMotion: "reduce" });
  await interactive.goto(`${base}/experience/rainy-window/`);
  await interactive.waitForTimeout(300);
  assert.equal(
    await interactive.locator("[data-status]").textContent(),
    "Stopped",
  );
  process.stdout.write(
    `PASS: ${parsed.length} pages, heading links, static images, no-JS navigation, Markdown, desktop/mobile layout, autoplay, stop/restart, reduced motion.\n`,
  );
} finally {
  await browser.close();
}
