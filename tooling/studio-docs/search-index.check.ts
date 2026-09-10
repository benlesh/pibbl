import assert from "node:assert/strict";
import MiniSearch from "minisearch";
import { resolve } from "node:path";

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
      route: "#/api/hooks/crc-when-changed",
      plainText:
        "crcWhenChanged\nRuns deterministic cleanup after dependency changes.",
      headings: [{ id: "crcwhenchanged", level: 1, text: "crcWhenChanged" }],
      sections: [
        {
          heading: { id: "crcwhenchanged", level: 1, text: "crcWhenChanged" },
          plainText: "Runs deterministic cleanup after dependency changes.",
        },
      ],
      frontmatter: {
        id: "api-hook-crc-when-changed",
        title: "crcWhenChanged",
        summary: "Runs deterministic cleanup after dependency changes.",
        kind: "api",
        slug: "crc-when-changed",
        apiCategory: "hook",
        symbols: ["crcWhenChanged"],
      },
    },
    {
      route: "#/learn/guides/lifecycle",
      plainText:
        "Lifecycle\ncrcWhenChanged crcWhenChanged crcWhenChanged repeats in prose.",
      headings: [{ id: "lifecycle", level: 1, text: "Lifecycle" }],
      sections: [
        {
          heading: { id: "lifecycle", level: 1, text: "Lifecycle" },
          plainText:
            "crcWhenChanged crcWhenChanged crcWhenChanged repeats in prose.",
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

assert.deepEqual(tokenizeSearchText("crcWhenChanged"), [
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
  searchSearchBundle(first, "crcWhenChanged")[0]?.url,
  "#/api/hooks/crc-when-changed",
);
assert.equal(
  searchSearchBundle(first, "filter", { kinds: ["example"] })[0]?.url,
  "#/examples/drawing/filters",
);
assert.equal(
  searchSearchBundle(first, "crcWhenChangd")[0]?.url,
  "#/api/hooks/crc-when-changed",
);
assert.equal(
  searchSearchBundle(first, "CRCFilter")[0]?.url,
  "#/api/types/filters#crcfilter",
  "A type symbol must prefer its owned heading over its type-domain root.",
);
assert.equal(
  first.searchRecords.some(
    ({ id }) => id === "api-types-filters#filter-types",
  ),
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
  ["crcWhenChanged", undefined],
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
  "The public CRCRef type must beat the lower-case crcRef hook.",
);
assert.equal(
  searchSearchBundle(realBundle, "CRCPointerEvent")[0]?.url,
  "#/api/types/events#crcpointerevent",
  "The public CRCPointerEvent type must resolve directly to its anchor.",
);

process.stdout.write(
  "Validated deterministic public MiniSearch records and ranking.\n",
);
