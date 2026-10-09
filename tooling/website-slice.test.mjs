import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir, access } from "node:fs/promises";

const output = new URL("../website/dist/", import.meta.url);
test("the home page keeps its title accessible without repeating the logo visually", async () => {
  const home = await readFile(new URL("index.html", output), "utf8");
  assert.match(home, /<h1 id="_top" class="home-page-title sr-only">Pibbl<\/h1>/);
  const start = await readFile(new URL("start/index.html", output), "utf8");
  assert.doesNotMatch(start, /home-page-title/);
  assert.match(start, /<h1 id="_top"[^>]*>Start<\/h1>/);
});

test("documentation branding publishes the selected logo in both themes", async () => {
  const html = await readFile(new URL("start/index.html", output), "utf8");
  const titleLink = html.match(/<a[^>]*class="site-title[^>]*>(.*?)<\/a>/s)?.[1];
  assert.ok(titleLink, "documentation header has a home link");
  assert.match(titleLink, /pibbl-logo-light/);
  assert.match(titleLink, /pibbl-logo-dark/);
  assert.match(titleLink, /class="sr-only\b[^"]*"[^>]*>\s*Pibbl\s*</);
  for (const [, src] of titleLink.matchAll(/src="([^"]+)"/g)) {
    await access(new URL(`.${src}`, output));
  }
  const favicon = await readFile(new URL("favicon.svg", output), "utf8");
  assert.match(favicon, /#FF735E/);
  assert.match(favicon, /#159447/);
  assert.match(favicon, /#8B5CCB/);
});

test("the first website slice publishes useful HTML and clean Markdown", async () => {
  for (const route of [
    "start",
    "reference",
    "catalogs",
    "guides",
    "examples",
    "agents",
    "playground",
    "guides/native-button",
  ]) {
    const html = await readFile(new URL(`${route}/index.html`, output), "utf8");
    assert.match(html, /<h1[^>]*>/);
    assert.match(html, /<main/);
    const markdown = await readFile(new URL(`${route}.md`, output), "utf8");
    assert.ok(markdown.length > 250, route);
    assert.doesNotMatch(markdown, /<Demo|import .*\.astro/);
  }
  const start = await readFile(new URL("start/index.html", output), "utf8");
  assert.match(start, /Build with Pibbl/);
  assert.match(start, /Add Pibbl to your site/);
  const recipe = await readFile(
    new URL("guides/native-button.md", output),
    "utf8",
  );
  assert.match(recipe, /function mountInkButton/);
  assert.match(recipe, /controller\?\.dispose\(\)/);
  assert.match(recipe, /prefers-reduced-motion/);
  assert.match(await readFile(new URL("llms.txt", output), "utf8"), /agents/);
  assert.ok(!(await readdir(output)).includes("testing"));
});

test("every catalog page and local link resolves in the static output", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("catalog.json", output), "utf8"),
  );
  for (const entry of catalog.entries) {
    const html = await readFile(
      new URL(`.${entry.url}index.html`, output),
      "utf8",
    );
    await access(new URL(`.${entry.markdown}`, output));
    assert.equal((html.match(/<h1 id="_top"/g) ?? []).length, 1, entry.url);
    for (const [, href] of html.matchAll(/href="(\/[^"#]*)(?:#[^"]*)?"/g)) {
      const path = href.endsWith("/") ? `${href}index.html` : href;
      await access(new URL(`.${path}`, output)).catch(() =>
        assert.fail(`${entry.url} links to missing ${href}`),
      );
    }
  }
});
