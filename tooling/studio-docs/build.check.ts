import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  learningExampleCatalog,
  tutorialSnapshotCatalog,
} from "@crc/scenarios";
import { buildNavigation } from "../../playground/src/app/navigation";
import { collectPublicExports, crcPublicEntryPaths } from "./api-exports";
import {
  buildStudioDocumentation,
  toStudioDocumentationSearchInput,
} from "./build";
import { crcStudioDocs, studioDocumentationBuildOptions } from "./vite-plugin";

const fixtureRoot = await mkdtemp(join(tmpdir(), "crc-studio-docs-build-"));
const repositoryRoot = resolve(import.meta.dirname, "../..");
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
    /Unknown workbench source/u,
  );

  await writeFixture("docs/site/learn/guides/first-scene.md", guide);
  await writeFixture(
    "docs/site/api/functions/nonexistent-live-example.md",
    api
      .replace("id: api-crc", "id: api-nonexistent-live-example")
      .replace("slug: crc", "slug: nonexistent-live-example")
      .replace("symbols: [crc]", "symbols: []")
      .replace(
        "# crc",
        "# Missing live example\n\n[Missing](#/examples/drawing/not-real)",
      ),
  );
  await assert.rejects(
    () =>
      buildStudioDocumentation({
        ...studioDocumentationBuildOptions(repositoryRoot),
        repositoryRoot: fixtureRoot,
        apiInventory: inventory,
      }),
    /Unknown live example route/u,
  );
  await rm(
    join(fixtureRoot, "docs/site/api/functions/nonexistent-live-example.md"),
  );
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
    "docs/site/learn/guides/first-scene.md",
    guide.replace("#/api/functions/crc", "#/examples/drawing/first-example"),
  );
  const exampleLinkOptions = {
    ...fixtureOptions,
    examples: [
      {
        slug: "first-example",
        title: "First example",
        shortTitle: "First example",
        section: "drawing",
        browseGroup: "drawing",
        summary: "A fixture example.",
        api: [],
        objectives: [],
        apiNotes: [],
        source: { path: "fixtures/first-example.tsx" },
      },
    ],
  };
  await assert.doesNotReject(() =>
    buildStudioDocumentation(exampleLinkOptions),
  );
  await writeFixture(
    "docs/site/learn/guides/first-scene.md",
    guide.replace("#/api/functions/crc", "#/examples/drawing/missing-example"),
  );
  await assert.rejects(
    () => buildStudioDocumentation(exampleLinkOptions),
    /Unknown live example route/u,
  );
  await writeFixture("docs/site/learn/guides/first-scene.md", guide);
  await writeFixture(
    "docs/site/api/functions/duplicate-crc.md",
    api
      .replace("api-crc", "api-duplicate-crc")
      .replace("slug: crc", "slug: duplicate-crc"),
  );
  await assert.rejects(
    () => buildStudioDocumentation(fixtureOptions),
    /Duplicate documented symbols: crc is assigned to both api-crc and api-duplicate-crc/u,
  );
  await rm(join(fixtureRoot, "docs/site/api/functions/duplicate-crc.md"));

  const typeFixtureInventory = {
    root: {
      values: ["crc"],
      types: ["CRCNode"],
      overview: [],
    },
  };
  await writeFixture(
    "docs/site/api/types/elements-components.md",
    `---
id: api-types-elements-components
title: Elements and components types
summary: The canonical CRC element type contract.
kind: api
slug: elements-components
apiCategory: types
typeDomain: elements-components
symbols: [CRCNode]
---

# Elements and components types

## CRCNode
`,
  );
  await writeFixture(
    "docs/site/api/types/events.md",
    `---
id: api-types-events
title: Event types
summary: A route with a deliberately misleading anchor fixture.
kind: api
slug: events
apiCategory: types
typeDomain: events
symbols: []
---

# Event types

## CRCNode
`,
  );
  await writeFixture(
    "docs/site/api/functions/uses-node.md",
    `---
id: api-function-uses-node
title: usesNode
summary: A type-link validation fixture.
kind: api
slug: uses-node
apiCategory: function
symbols: []
relatedTypes: [CRCNode]
---

# usesNode

Links [CRCNode](#/api/types/events#crcnode) to the wrong valid type anchor.
`,
  );
  await assert.rejects(
    () =>
      buildStudioDocumentation({
        ...fixtureOptions,
        apiInventory: typeFixtureInventory,
      }),
    /CRCNode must link to #\/api\/types\/elements-components#crcnode/u,
  );
  await rm(join(fixtureRoot, "docs/site/api/functions/uses-node.md"));
  await rm(join(fixtureRoot, "docs/site/api/types"), {
    force: true,
    recursive: true,
  });

  const tutorialRoot = (slug: string, title: string) => `---
id: tutorial-${slug}
title: ${title}
summary: A future tutorial root fixture.
kind: tutorial
slug: ${slug}
tutorial: ${slug}
---

# ${title}
`;
  const tutorialChapter = (
    tutorial: string,
    slug: string,
    order: number,
  ) => `---
id: tutorial-${tutorial}-${slug}
title: ${slug}
summary: A tutorial chapter fixture.
kind: tutorial
slug: ${slug}
tutorial: ${tutorial}
order: ${String(order)}
---

# ${slug}
`;
  await writeFixture(
    "docs/site/learn/tutorials/diagram-editor/index.md",
    tutorialRoot("diagram-editor", "Learn the basics"),
  );
  await writeFixture(
    "docs/site/learn/tutorials/diagram-editor/first.md",
    tutorialChapter("diagram-editor", "first", 1),
  );
  await writeFixture(
    "docs/site/learn/tutorials/advanced-animation/index.md",
    tutorialRoot("advanced-animation", "Animate a scene"),
  );
  await writeFixture(
    "docs/site/learn/tutorials/advanced-animation/timeline.md",
    tutorialChapter("advanced-animation", "timeline", 1),
  );
  await writeFixture(
    "docs/site/learn/tutorials/advanced-animation/publish.md",
    tutorialChapter("advanced-animation", "publish", 2),
  );
  const multipleTutorials = await buildStudioDocumentation(fixtureOptions);
  const timeline =
    multipleTutorials.pageByRoute[
      "#/learn/tutorials/advanced-animation/timeline"
    ];
  const publish =
    multipleTutorials.pageByRoute[
      "#/learn/tutorials/advanced-animation/publish"
    ];
  assert.deepEqual(timeline.tutorialRelationship, {
    rootRoute: "#/learn/tutorials/advanced-animation",
    chapter: 1,
    chapterCount: 2,
    previous: {
      route: "#/learn/tutorials/advanced-animation",
      title: "Animate a scene",
    },
    next: {
      route: "#/learn/tutorials/advanced-animation/publish",
      title: "publish",
    },
  });
  assert.deepEqual(publish.tutorialRelationship?.previous, {
    route: "#/learn/tutorials/advanced-animation/timeline",
    title: "timeline",
  });
  assert.equal(publish.tutorialRelationship?.next, undefined);
  assert.equal(
    multipleTutorials.pageByRoute["#/learn/tutorials/advanced-animation"]
      .tutorialRelationship,
    undefined,
  );
  assert.deepEqual(
    multipleTutorials.pages
      .filter(({ frontmatter }) => frontmatter.kind === "tutorial")
      .map(({ route }) => route),
    [
      "#/learn/tutorials/advanced-animation",
      "#/learn/tutorials/advanced-animation/publish",
      "#/learn/tutorials/advanced-animation/timeline",
      "#/learn/tutorials/diagram-editor/first",
      "#/learn/tutorials/diagram-editor",
    ],
    "Validated tutorial frontmatter must model multiple roots and chapters.",
  );
  assert.deepEqual(
    buildNavigation(multipleTutorials, [])
      .at(0)
      ?.children?.[0]?.children?.map(({ href }) => href),
    [
      "#/learn/tutorials/advanced-animation",
      "#/learn/tutorials/diagram-editor",
    ],
    "Navigation must retain each tutorial root while hiding chapters beneath it.",
  );
  await writeFixture(
    "docs/site/learn/tutorials/diagram-editor/first.md",
    tutorialChapter("diagram-editor", "first", 1).replace(
      "order: 1",
      "order: 1\nexampleSlug: tutorial-only",
    ),
  );
  const tutorialWorkbench = await buildStudioDocumentation({
    ...fixtureOptions,
    workbenchSources: [
      {
        slug: "tutorial-only",
        source: { path: "fixtures/tutorial-only.example.tsx" },
      },
    ],
  });
  assert.deepEqual(
    tutorialWorkbench.examples,
    [],
    "Tutorial workbench sources must not become public Examples.",
  );
  assert.deepEqual(
    toStudioDocumentationSearchInput(tutorialWorkbench).examples,
    [],
    "Tutorial workbench sources must not create independent search records.",
  );
  await rm(
    join(fixtureRoot, "docs/site/learn/tutorials/advanced-animation/index.md"),
  );
  await assert.rejects(
    () => buildStudioDocumentation(fixtureOptions),
    /requires exactly one matching tutorial root/u,
    "Tutorial chapters must not produce an orphan route tree.",
  );
  await writeFixture(
    "docs/site/learn/tutorials/advanced-animation/index.md",
    tutorialRoot("advanced-animation", "Animate a scene"),
  );
  await writeFixture(
    "docs/site/learn/tutorials/diagram-editor/first.md",
    tutorialChapter("diagram-editor", "first", 1),
  );
  await writeFixture(
    "docs/site/learn/tutorials/diagram-editor/third.md",
    tutorialChapter("diagram-editor", "third", 3),
  );
  await assert.rejects(
    () => buildStudioDocumentation(fixtureOptions),
    /chapter order must be unique and contiguous/u,
  );
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}

const real = await buildStudioDocumentation({
  repositoryRoot: resolve(import.meta.dirname, "../.."),
  apiInventory: await collectPublicExports(crcPublicEntryPaths, {}),
  examples: learningExampleCatalog,
  workbenchSources: [...learningExampleCatalog, ...tutorialSnapshotCatalog],
});

assert.deepEqual(
  real.pages
    .filter(({ frontmatter }) => frontmatter.kind === "guide")
    .sort((left, right) => left.frontmatter.order! - right.frontmatter.order!)
    .map(({ frontmatter }) => frontmatter.title),
  [
    "Configure JSX",
    "Author without JSX",
    "Understand components, props, and children",
    "Style and draw",
    "Compose and lay out scenes",
    "Manage state and lifecycle",
    "Use signals and animation",
    "Add WebGL islands",
    "Add focus and keyboard navigation",
    "Create custom components and primitives",
    "Integrate with React",
    "Troubleshoot JSX",
  ],
);
assert.equal(
  real.pageByRoute["#/learn/guides/configure-jsx"].frontmatter.exampleSlug,
  "getting-started",
);
assert.equal(
  real.pageByRoute["#/learn/guides/author-without-jsx"].frontmatter.exampleSlug,
  "create-element-authoring",
);
assert.match(
  real.pageByRoute["#/learn/tutorials/diagram-editor"].plainText,
  /Finish and harden the editor/u,
);
assert.match(
  real.pageByRoute["#/learn/guides/components-props-and-children"].plainText,
  /Style and draw/u,
);
assert.doesNotMatch(
  real.pageByRoute["#/learn/guides/components-props-and-children"].plainText,
  /Filters are typed local style/u,
);
assert.match(
  real.pageByRoute["#/learn/guides/style-and-draw"].plainText,
  /Filters are typed local style/u,
);

const runtimeCoverage = real.apiCoverage;
assert.equal(runtimeCoverage.values.Fragment?.route, "#/api");
assert.equal(
  runtimeCoverage.values.createCirclePath?.route,
  "#/api/functions/create-circle-path",
);
assert.equal(
  runtimeCoverage.values.crcWhenChanged?.route,
  "#/api/hooks/crc-when-changed",
);
assert.deepEqual(runtimeCoverage.duplicateValues, []);
assert.deepEqual(runtimeCoverage.missingValues, []);
assert.deepEqual(runtimeCoverage.missingTypes, []);
assert.deepEqual(runtimeCoverage.unknownSymbols, []);
assert.deepEqual(runtimeCoverage.duplicateSymbols, []);
for (const symbol of ["JSX", "jsx", "jsxDEV", "jsxs"]) {
  assert.equal(
    runtimeCoverage.overview[symbol]?.route,
    "#/api",
    `${symbol} must remain discoverable from the API overview`,
  );
}

const typeDomains = [
  "canvas-runtime",
  "elements-components",
  "events",
  "filters",
  "layout",
  "styles",
  "webgl",
] as const;
const typeCollator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});
for (const domain of typeDomains) {
  const page = real.pageByRoute[`#/api/types/${domain}`];
  assert.ok(page, `Missing API type domain page: ${domain}`);
  const typeHeadings = page.headings
    .filter(({ level }) => level === 2)
    .map(({ text }) => text.replaceAll("`", ""));
  assert.deepEqual(
    typeHeadings,
    page.frontmatter.symbols ?? [],
    `${domain} must have one heading for every owned type symbol`,
  );
  assert.deepEqual(
    typeHeadings,
    [...typeHeadings].sort(typeCollator.compare),
    `${domain} type headings must be alphabetized`,
  );
  for (const typeName of typeHeadings) {
    const anchor = typeName.toLowerCase();
    assert.equal(
      page.headings.some(({ id }) => id === anchor),
      true,
      `${domain} must expose a stable anchor for ${typeName}`,
    );
    assert.equal(
      real.pageByRoute[`#/api/types/${domain}`]?.headings.some(
        ({ id }) => id === anchor,
      ),
      true,
      `#/api/types/${domain}#${anchor} must resolve to ${typeName}`,
    );
  }
}

const apiNavigation = buildNavigation({ pages: real.pages }, []).find(
  ({ id }) => id === "api",
)!;
for (const category of ["components", "functions", "hooks"] as const) {
  const titles =
    apiNavigation.children
      ?.find(({ id }) => id === `api-${category}`)
      ?.children?.map(({ label }) => label) ?? [];
  assert.deepEqual(
    titles,
    [...titles].sort(
      new Intl.Collator("en", { sensitivity: "base", numeric: true }).compare,
    ),
  );
}

const documentationPlugin = crcStudioDocs({ repositoryRoot });
const buildStart = documentationPlugin.buildStart as unknown as (this: {
  addWatchFile(path: string): void;
}) => Promise<void>;
await buildStart.call({ addWatchFile() {} });
const load = documentationPlugin.load as unknown as (
  this: object,
  id: string,
) => Promise<string | undefined>;
const documentationModule = await load.call({}, "\0virtual:crc-studio-docs");
const searchModule = await load.call({}, "\0virtual:crc-studio-search");
assert.equal(typeof documentationModule, "string");
assert.equal(typeof searchModule, "string");
assert.doesNotMatch(
  documentationModule!,
  /serializedSearchIndex|searchRecords/u,
);
assert.doesNotMatch(
  documentationModule!,
  /"(?:plainText|sections|internalLinks|sourcePath|aliases)":/u,
);
assert.match(searchModule!, /serializedSearchIndex/u);
assert.match(searchModule!, /#\/examples\/drawing\/filters/u);

process.stdout.write(
  "Validated the deterministic Studio documentation manifest.\n",
);
