import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildStudioDocumentation } from "./build";

const fixtureRoot = await mkdtemp(join(tmpdir(), "crc-studio-docs-build-"));
const inventory = {
  root: {
    values: ["crc"],
    types: [],
    overview: [],
  },
};

const guide = `---
id: learn-first-scene
title: First scene
summary: Build a first public scene.
kind: guide
slug: first-scene
order: 1
---

# First scene

Read the [crc API](#/api/functions/crc).
`;

const api = `---
id: api-crc
title: crc
summary: Mount a CRC scene.
kind: api
slug: crc
apiCategory: function
symbols: [crc]
---

# crc
`;

async function writeFixture(path: string, source: string): Promise<void> {
  const destination = join(fixtureRoot, path);
  await mkdir(join(destination, ".."), { recursive: true });
  await writeFile(destination, source, "utf8");
}

try {
  await writeFixture("docs/site/learn/guides/first-scene.md", guide);
  await writeFixture("docs/site/api/functions/crc.md", api);
  await writeFixture(
    "docs/design/internal.md",
    "# Internal design notes must not be public.\n",
  );

  const fixtureOptions = {
    repositoryRoot: fixtureRoot,
    apiInventory: inventory,
    examples: [],
  };
  const first = await buildStudioDocumentation(fixtureOptions);
  const second = await buildStudioDocumentation(fixtureOptions);

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(
    first.pages.map(({ route }) => route),
    ["#/api/functions/crc", "#/learn/guides/first-scene"],
  );
  assert.ok(
    first.pages.every(({ sourcePath }) => sourcePath.startsWith("docs/site/")),
  );
  assert.equal(
    first.pages.some(({ sourcePath }) => sourcePath.includes("internal")),
    false,
  );

  const overview = `---
id: api-overview-one
title: API overview
summary: An overview route collision fixture.
kind: api
slug: overview-one
apiCategory: overview
---

# API overview
`;
  await writeFixture("docs/site/api/overview-one.md", overview);
  await writeFixture(
    "docs/site/api/overview-two.md",
    overview
      .replace("api-overview-one", "api-overview-two")
      .replace("overview-one", "overview-two"),
  );
  await assert.rejects(
    () => buildStudioDocumentation(fixtureOptions),
    /Duplicate canonical route/u,
  );
  await rm(join(fixtureRoot, "docs/site/api/overview-one.md"));
  await rm(join(fixtureRoot, "docs/site/api/overview-two.md"));

  await writeFixture(
    "docs/site/learn/guides/first-scene.md",
    guide.replace("#/api/functions/crc", "#/api/functions/missing"),
  );
  await assert.rejects(
    () => buildStudioDocumentation(fixtureOptions),
    /Unknown internal route/u,
  );

  await writeFixture(
    "docs/site/learn/guides/first-scene.md",
    guide.replace("#/api/functions/crc", "#/api/functions/crc#missing"),
  );
  await assert.rejects(
    () => buildStudioDocumentation(fixtureOptions),
    /Unknown internal anchor/u,
  );

  await writeFixture(
    "docs/site/learn/guides/first-scene.md",
    guide.replace("order: 1", "order: 1\nexampleSlug: missing-example"),
  );
  await assert.rejects(
    () => buildStudioDocumentation(fixtureOptions),
    /Unknown learning example/u,
  );

  await writeFixture("docs/site/learn/guides/first-scene.md", guide);
  await writeFixture(
    "docs/site/learn/guides/first-scene.md",
    guide.replace(
      "order: 1",
      "order: 1\naliases: [legacy-first-scene, '#/legacy/first-scene']",
    ),
  );
  const aliases = await buildStudioDocumentation(fixtureOptions);
  assert.equal(
    aliases.legacyRouteToRoute["#/learn/guides/legacy-first-scene"],
    "#/learn/guides/first-scene",
  );
  assert.equal(
    aliases.legacyRouteToRoute["#/legacy/first-scene"],
    "#/learn/guides/first-scene",
  );

  for (const invalidAlias of [
    "../../outside",
    "legacy?query",
    "legacy#fragment",
    "#/legacy/../outside",
    "#/legacy?query",
    "#/legacy#fragment",
    "#/Legacy",
  ]) {
    await writeFixture(
      "docs/site/learn/guides/first-scene.md",
      guide.replace("order: 1", `order: 1\naliases: ['${invalidAlias}']`),
    );
    await assert.rejects(
      () => buildStudioDocumentation(fixtureOptions),
      /Invalid legacy alias/u,
    );
  }

  await writeFixture("docs/site/learn/guides/first-scene.md", guide);
  await writeFixture(
    "docs/site/api/functions/duplicate-crc.md",
    api
      .replace("api-crc", "api-duplicate-crc")
      .replace("slug: crc", "slug: duplicate-crc"),
  );
  await assert.rejects(
    () => buildStudioDocumentation(fixtureOptions),
    /Duplicate documented API symbols: crc/u,
  );
  await rm(join(fixtureRoot, "docs/site/api/functions/duplicate-crc.md"));

  const tutorialChapter = (slug: string, order: number) => `---
id: tutorial-${slug}
title: ${slug}
summary: A tutorial chapter fixture.
kind: tutorial
slug: ${slug}
tutorial: diagram-editor
order: ${String(order)}
---

# ${slug}
`;
  await writeFixture(
    "docs/site/learn/tutorials/diagram-editor/first.md",
    tutorialChapter("first", 1),
  );
  await writeFixture(
    "docs/site/learn/tutorials/diagram-editor/third.md",
    tutorialChapter("third", 3),
  );
  await assert.rejects(
    () => buildStudioDocumentation(fixtureOptions),
    /chapter order must be unique and contiguous/u,
  );
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}

process.stdout.write(
  "Validated the deterministic Studio documentation manifest.\n",
);
