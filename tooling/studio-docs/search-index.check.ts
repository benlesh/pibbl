import assert from "node:assert/strict";
import MiniSearch from "minisearch";
import { resolve } from "node:path";
import {
  learningExampleCatalog,
  tutorialSnapshotCatalog,
} from "@crc/scenarios";

import { buildStudioDocumentation } from "./build";
import {
  buildSearchBundle,
  querySearchIndex,
  searchSearchBundle,
  searchIndexOptions,
  tokenizeSearchText,
  type SearchBundleInput,
} from "./search-index";

const input = {
  pages: [
    {
      route: "#/api/hooks/use-when-changed",
      plainText:
        "useWhenChanged\nRuns deterministic cleanup after dependency changes.",
      headings: [{ id: "crcwhenchanged", level: 1, text: "useWhenChanged" }],
      sections: [
        {
          heading: { id: "crcwhenchanged", level: 1, text: "useWhenChanged" },
          plainText: "Runs deterministic cleanup after dependency changes.",
        },
      ],
      frontmatter: {
        id: "api-hook-use-when-changed",
        title: "useWhenChanged",
        summary: "Runs deterministic cleanup after dependency changes.",
        kind: "api",
        slug: "use-when-changed",
        apiCategory: "hook",
        symbols: ["useWhenChanged"],
      },
    },
    {
      route: "#/learn/guides/lifecycle",
      plainText:
        "Lifecycle\ncrcWhenChanged useWhenChanged useWhenChanged repeats in prose.",
      headings: [{ id: "lifecycle", level: 1, text: "Lifecycle" }],
      sections: [
        {
          heading: { id: "lifecycle", level: 1, text: "Lifecycle" },
          plainText:
            "useWhenChanged useWhenChanged useWhenChanged repeats in prose.",
        },
      ],
      frontmatter: {
        id: "guide-lifecycle",
        title: "Lifecycle guide",
        summary: "Repeat a symbol in prose to compete with its API reference.",
        kind: "guide",
        slug: "lifecycle",
      },
    },
    {
      route: "#/api/types/filters",
      plainText: "Filter types\nCRCFilter\nDescribes typed filters.",
      headings: [
        { id: "filter-types", level: 1, text: "Filter types" },
        { id: "crcfilter", level: 2, text: "CRCFilter" },
      ],
      sections: [
        {
          heading: { id: "filter-types", level: 1, text: "Filter types" },
          plainText: "",
        },
        {
          heading: { id: "crcfilter", level: 2, text: "CRCFilter" },
          plainText: "Describes typed filters.",
        },
      ],
      frontmatter: {
        id: "api-types-filters",
        title: "Filter types",
        summary: "Describes typed filters.",
        kind: "api",
        slug: "filters",
        apiCategory: "types",
        typeDomain: "filters",
        symbols: ["CRCFilter"],
      },
    },
    {
      route: "#/testing/internal-only",
      plainText: "Internal only",
      headings: [],
      sections: [],
      frontmatter: {
        id: "internal:test-lab",
        title: "Internal test lab",
        summary: "Must never enter public search.",
        kind: "guide",
        slug: "internal-test-lab",
      },
    },
  ],
  examples: [
    {
      slug: "filters",
      title: "Filters",
      shortTitle: "Filters",
      browseGroup: "drawing",
      summary: "Compare typed Canvas filters.",
      api: ["Group", "CRCFilter"],
      objectives: ["Apply filters", "Compare filter order"],
      apiNotes: ["Filters are local typed style."],
    },
    {
      slug: "getting-started",
      title: "Getting started",
      shortTitle: "Getting started",
      summary: "Belongs to Learn, not the public Examples browse tree.",
      api: [],
      objectives: ["Start", "Finish"],
      apiNotes: [],
    },
  ],
} satisfies SearchBundleInput;

const first = buildSearchBundle(input);
const second = buildSearchBundle(input);

assert.deepEqual(tokenizeSearchText("useWhenChanged"), [
  "crcwhenchanged",
  "crc",
  "when",
  "changed",
]);
assert.equal(JSON.stringify(first), JSON.stringify(second));
assert.equal(
  first.searchRecords.some(({ url }) => url.startsWith("#/testing")),
  false,
);
assert.equal(
  first.searchRecords.some(({ id }) => id.startsWith("internal:")),
  false,
);
assert.equal(
  first.searchRecords.some(
    ({ url }) => url === "#/api/types/filters#crcfilter",
  ),
  true,
);
assert.equal(
  first.searchRecords.some(({ url }) => url.includes("getting-started")),
  false,
);
assert.equal(
  searchSearchBundle(first, "useWhenChanged")[0]?.url,
  "#/api/hooks/use-when-changed",
);
assert.equal(
  searchSearchBundle(first, "filter", { kinds: ["example"] })[0]?.url,
  "#/examples/drawing/filters",
);
assert.equal(
  searchSearchBundle(first, "crcWhenChangd")[0]?.url,
  "#/api/hooks/use-when-changed",
);
assert.equal(
  searchSearchBundle(first, "CRCFilter")[0]?.url,
  "#/api/types/filters#crcfilter",
  "A type symbol must prefer its owned heading over its type-domain root.",
);
assert.equal(
  first.searchRecords.some(({ id }) => id === "api-types-filters#filter-types"),
  false,
  "A page root and its H1 section must not create duplicate destinations.",
);
assert.throws(
  () =>
    buildSearchBundle({
      ...input,
      pages: [{ ...input.pages[0], route: "#/api-not-a-public-route" }],
    }),
  /Invalid public search URL/u,
);

const restoredBrowserIndex = MiniSearch.loadJSON(
  first.serializedSearchIndex,
  searchIndexOptions(),
);
for (const [query, options] of [
  ["useWhenChanged", undefined],
  ["crcWhen", undefined],
  ["crcWhenChangd", undefined],
  ["filter", { kinds: ["example"] }],
] as const) {
  assert.deepEqual(
    querySearchIndex(
      restoredBrowserIndex,
      first.searchRecords,
      query,
      options,
    ).map(({ id, url }) => ({ id, url })),
    searchSearchBundle(first, query, options).map(({ id, url }) => ({
      id,
      url,
    })),
    `Restored browser index must preserve the build query contract for ${query}.`,
  );
}

const realDocumentation = await buildStudioDocumentation({
  repositoryRoot: resolve(import.meta.dirname, "../.."),
  examples: learningExampleCatalog,
  workbenchSources: [...learningExampleCatalog, ...tutorialSnapshotCatalog],
});
const realBundle = buildSearchBundle({
  pages: realDocumentation.pages,
  examples: realDocumentation.examples,
});
for (const [symbol, destination] of Object.entries(
  realDocumentation.apiCoverage.types,
)) {
  const page = realDocumentation.pageByRoute[destination.route];
  if (page?.frontmatter.apiCategory !== "types") {
    assert.equal(
      searchSearchBundle(realBundle, symbol)[0]?.url,
      destination.route,
      `${symbol} must rank its exact API owner first.`,
    );
    continue;
  }
  const heading = page?.headings.find(
    ({ level, text }) => level === 2 && text.replaceAll("`", "") === symbol,
  );
  assert.ok(
    heading,
    `${symbol} must have one owning API type heading in the public manifest.`,
  );
  assert.equal(
    searchSearchBundle(realBundle, symbol)[0]?.url,
    `${destination.route}#${heading.id}`,
    `${symbol} must rank its exact type anchor first.`,
  );
}
assert.equal(
  searchSearchBundle(realBundle, "CRCRef")[0]?.url,
  "#/api/types/canvas-runtime#crcref",
  "The public CRCRef type must beat the lower-case useRef hook.",
);
assert.equal(
  searchSearchBundle(realBundle, "CRCPointerEvent")[0]?.url,
  "#/api/types/events#crcpointerevent",
  "The public CRCPointerEvent type must resolve directly to its anchor.",
);
assert.equal(
  searchSearchBundle(realBundle, "pointer capture diagram editor").some(
    ({ url }) => url === "#/learn/tutorials/diagram-editor/dragging",
  ),
  true,
  "The pointer-capture diagram-editor query must return Chapter 7.",
);
const tutorialPages = realDocumentation.pages.filter(
  ({ frontmatter }) =>
    frontmatter.kind === "tutorial" &&
    frontmatter.tutorial === "diagram-editor" &&
    frontmatter.order !== undefined,
);
assert.equal(
  tutorialPages.length,
  12,
  "All twelve tutorial chapters must publish.",
);
for (const chapter of tutorialPages) {
  const chapterRecords = realBundle.searchRecords.filter(
    ({ url }) => url === chapter.route || url.startsWith(`${chapter.route}#`),
  );
  assert.equal(
    chapterRecords.length,
    7,
    `${chapter.route} must publish one root and six H2 Learn records.`,
  );
}
for (const { slug } of tutorialSnapshotCatalog) {
  assert.equal(
    realBundle.searchRecords.some(({ id }) => id === `example:${slug}`),
    false,
    "Tutorial snapshots must not become independent Examples search records.",
  );
}

process.stdout.write(
  "Validated deterministic public MiniSearch records and ranking.\n",
);
