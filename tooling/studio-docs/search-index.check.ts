import assert from "node:assert/strict";
import MiniSearch from "minisearch";
import { resolve } from "node:path";
import {
  learningExampleCatalog,
  tutorialSnapshotCatalog,
} from "@pibbl/scenarios";

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
      route: "#/api/hooks/use-reaction",
      plainText:
        "useReaction\nRuns deterministic cleanup after signal changes.",
      headings: [{ id: "usereaction", level: 1, text: "useReaction" }],
      sections: [
        {
          heading: { id: "usereaction", level: 1, text: "useReaction" },
          plainText: "Runs deterministic cleanup after signal changes.",
        },
      ],
      frontmatter: {
        id: "api-hook-use-reaction",
        title: "useReaction",
        summary: "Runs deterministic cleanup after signal changes.",
        kind: "api",
        slug: "use-reaction",
        apiCategory: "hook",
        symbols: ["useReaction"],
      },
    },
    {
      route: "#/learn/guides/lifecycle",
      plainText:
        "Lifecycle\nreaction useReaction useReaction repeats in prose.",
      headings: [{ id: "lifecycle", level: 1, text: "Lifecycle" }],
      sections: [
        {
          heading: { id: "lifecycle", level: 1, text: "Lifecycle" },
          plainText:
            "useReaction useReaction useReaction repeats in prose.",
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
      plainText: "Filter types\nPibblFilter\nDescribes typed filters.",
      headings: [
        { id: "filter-types", level: 1, text: "Filter types" },
        { id: "pibblfilter", level: 2, text: "PibblFilter" },
      ],
      sections: [
        {
          heading: { id: "filter-types", level: 1, text: "Filter types" },
          plainText: "",
        },
        {
          heading: { id: "pibblfilter", level: 2, text: "PibblFilter" },
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
        symbols: ["PibblFilter"],
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
      api: ["Group", "PibblFilter"],
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

assert.deepEqual(tokenizeSearchText("useReaction"), [
  "usereaction",
  "use",
  "reaction",
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
    ({ url }) => url === "#/api/types/filters#pibblfilter",
  ),
  true,
);
assert.equal(
  first.searchRecords.some(({ url }) => url.includes("getting-started")),
  false,
);
assert.equal(
  searchSearchBundle(first, "useReaction")[0]?.url,
  "#/api/hooks/use-reaction",
);
assert.equal(
  searchSearchBundle(first, "filter", { kinds: ["example"] })[0]?.url,
  "#/examples/drawing/filters",
);
assert.equal(
  searchSearchBundle(first, "useReacton")[0]?.url,
  "#/api/hooks/use-reaction",
);
assert.equal(
  searchSearchBundle(first, "PibblFilter")[0]?.url,
  "#/api/types/filters#pibblfilter",
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
  ["useReaction", undefined],
  ["reaction", undefined],
  ["useReacton", undefined],
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
  searchSearchBundle(realBundle, "PibblRef")[0]?.url,
  "#/api/types/canvas-runtime#pibblref",
  "The public PibblRef type must beat the lower-case useRef hook.",
);
assert.equal(
  searchSearchBundle(realBundle, "PibblPointerEvent")[0]?.url,
  "#/api/types/events#pibblpointerevent",
  "The public PibblPointerEvent type must resolve directly to its anchor.",
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
