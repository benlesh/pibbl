import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { galleries } from "../website/gallery.mjs";
import { loadAuthored } from "../website/documentation.mjs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

test("the website generator publishes the approved Brick Climb source files", async () => {
  const root = resolve(import.meta.dirname, "..");
  execFileSync(
    process.execPath,
    ["--import", "tsx", "website/prepare-content.mjs"],
    {
      cwd: root,
      stdio: "pipe",
    },
  );
  const markdown = await readFile(
    resolve(root, "website/public/generated/examples/brick-climb.md"),
    "utf8",
  );
  const records = await loadAuthored(root);
  for (const file of records.find(
    (record) => record.id === "examples/brick-climb",
  ).meta.sources) {
    assert.ok(
      markdown.includes(await readFile(resolve(root, file), "utf8")),
      `missing complete source: ${file}`,
    );
  }
});

test("Brick Climb is discoverable as a standalone showcase with a focused sprite companion", async () => {
  const records = await loadAuthored(resolve(import.meta.dirname, ".."));
  const page = records.find((record) => record.id === "examples/brick-climb");
  assert.ok(page, "published showcase page");
  assert.ok(
    galleries
      .find((gallery) => gallery.id === "showcases")
      .pages.includes(page.id),
  );
  assert.match(
    records.find((record) => record.id === "examples").content,
    /\/examples\/brick-climb\//,
  );
  assert.match(page.content, /#\/examples\/composition\/sprites/);
  assert.match(page.content, /pnpm@11\.21\.0 brick-climb/);
  assert.match(page.content, /5191/);
  assert.ok(page.meta.sources.includes("games/brick-climb/scene.tsx"));
  const guide = await readFile(
    new URL("../docs/site/learn/guides/sprites.md", import.meta.url),
    "utf8",
  );
  assert.match(guide, /\/examples\/brick-climb\//);
});
