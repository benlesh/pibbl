import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { parsePublicMarkdown, validatePublicDocFrontmatter } from "./markdown";

const fixturesDirectory = fileURLToPath(
  new URL("./fixtures/", import.meta.url),
);
const validGuidePath = `${fixturesDirectory}valid-guide.md`;
const invalidScriptPath = `${fixturesDirectory}invalid-script.md`;

const guide = await readFile(validGuidePath, "utf8");
const invalidScript = await readFile(invalidScriptPath, "utf8");
const loaded = parsePublicMarkdown(
  "docs/site/learn/guides/valid-guide.md",
  guide,
);

assert.equal(loaded.frontmatter.kind, "guide");
assert.equal(loaded.route, "#/learn/guides/valid-guide");
assert.deepEqual(
  loaded.headings.map(({ id }) => id),
  ["first-step", "first-step-2"],
);
assert.match(loaded.html, /<table>/u);
assert.doesNotMatch(loaded.html, /<script/u);
assert.match(loaded.html, /href="https:\/\/crc\.dev" rel="noreferrer"/u);
assert.deepEqual(loaded.internalLinks, [
  { href: "#/api/functions/crc", sourceHeading: "first-step" },
]);
assert.equal(
  parsePublicMarkdown(
    "docs/site/learn/tutorials/diagram-editor/index.md",
    `---
id: tutorial-diagram-editor
title: "Learn the basics: Build a diagram editor"
summary: A real-world project tutorial.
kind: tutorial
slug: diagram-editor
tutorial: diagram-editor
---

# Diagram editor`,
  ).route,
  "#/learn/tutorials/diagram-editor",
);
assert.deepEqual(
  parsePublicMarkdown(
    "docs/site/learn/guides/anchor-collisions.md",
    `---
id: anchor-collisions
title: Anchor collisions
summary: Validate unique heading IDs when a natural suffix already exists.
kind: guide
slug: anchor-collisions
---

# A

# A

# A 2`,
  ).headings.map(({ id }) => id),
  ["a", "a-2", "a-2-2"],
);
assert.throws(
  () =>
    validatePublicDocFrontmatter(
      {
        id: "unknown-kind",
        title: "Unknown kind",
        summary: "Reject unknown public document kinds.",
        kind: "reference",
        slug: "unknown-kind",
      },
      "unknown-kind.md",
    ),
  /kind/u,
);
assert.throws(
  () =>
    validatePublicDocFrontmatter(
      {
        id: "bad-slug",
        title: "Bad slug",
        summary: "Reject unstable route slugs.",
        kind: "guide",
        slug: "Bad Slug",
      },
      "bad-slug.md",
    ),
  /slug/u,
);
assert.throws(
  () => parsePublicMarkdown("invalid.md", invalidScript),
  /Raw HTML is not supported/u,
);

process.stdout.write(
  "Validated public documentation metadata and safe Markdown rendering.\n",
);
