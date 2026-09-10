import MiniSearch, { type Options } from "minisearch";

import type {
  StudioDocumentationExample,
  StudioDocumentationPage,
} from "./build";
import type { PublicDocHeading } from "./model";

export type SearchKind = "learn" | "api" | "example";

/** Plain-text result metadata shipped beside the serialized MiniSearch data. */
export interface SearchRecord {
  readonly id: string;
  readonly url: string;
  readonly kind: SearchKind;
  readonly title: string;
  readonly breadcrumb: string;
  readonly heading: string;
  readonly summary: string;
  readonly symbols: string;
  readonly aliases: string;
  readonly keywords: string;
  readonly body: string;
}

export interface SearchBundleInput {
  readonly pages: readonly Pick<
    StudioDocumentationPage,
    "frontmatter" | "route" | "plainText" | "headings" | "sections"
  >[];
  readonly examples: readonly Pick<
    StudioDocumentationExample,
    | "slug"
    | "title"
    | "shortTitle"
    | "browseGroup"
    | "summary"
    | "api"
    | "objectives"
    | "apiNotes"
  >[];
}

export interface SerializedSearchBundle {
  readonly serializedSearchIndex: string;
  readonly searchRecords: readonly SearchRecord[];
}

export interface SearchBundleQueryOptions {
  readonly kinds?: readonly SearchKind[];
}

const searchableFields = [
  "symbols",
  "aliases",
  "title",
  "heading",
  "keywords",
  "summary",
  "body",
] as const;

const fieldBoosts = {
  symbols: 100,
  aliases: 100,
  title: 50,
  heading: 25,
  keywords: 15,
  summary: 5,
  body: 1,
} as const;

const exactApiSymbolBoost = 1_000_000;
const publicSearchUrl =
  /^#\/(?:learn(?:\/(?:guides|tutorials)(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?|api(?:\/(?:components|functions|hooks|types)(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?|examples\/(?:drawing|composition|layout|events-and-interaction|focus-and-keyboard)\/[a-z0-9]+(?:-[a-z0-9]+)*)(?:#[a-z0-9]+(?:-[a-z0-9]+)*)?$/u;

/**
 * The matching configuration must remain identical when the browser restores
 * the serialized index. It intentionally indexes only plain-text record fields.
 */
export function searchIndexOptions(): Options<SearchRecord> {
  return {
    idField: "id",
    fields: [...searchableFields],
    tokenize: (value) => [...tokenizeSearchText(value)],
    processTerm: (term) => term,
  };
}

/**
 * Preserves an identifier's normalized spelling and adds its camel-case parts.
 * This lets an API search match either `crcWhenChanged` or `when changed`.
 */
export function tokenizeSearchText(value: string): readonly string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const word of value.match(/[\p{L}\p{N}]+/gu) ?? []) {
    addToken(tokens, seen, normalizeToken(word));
    const split = word
      .replace(/([a-z\d])([A-Z])/gu, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2");
    for (const part of split.match(/[\p{L}\p{N}]+/gu) ?? []) {
      addToken(tokens, seen, normalizeToken(part));
    }
  }
  return tokens;
}

/** Builds stable, public-only records and serializes MiniSearch without paths. */
export function buildSearchBundle(
  input: SearchBundleInput,
): SerializedSearchBundle {
  const searchRecords = collectSearchRecords(input);
  const index = new MiniSearch<SearchRecord>(searchIndexOptions());
  index.addAll(searchRecords);
  return {
    serializedSearchIndex: JSON.stringify(index.toJSON()),
    searchRecords,
  };
}

/**
 * Queries one already-restored MiniSearch instance using CRC's public ranking
 * contract. This is browser-safe: all source imports other than MiniSearch are
 * type-only, so the lazy browser search can use it without build-time tooling.
 */
export function querySearchIndex(
  index: MiniSearch<SearchRecord>,
  searchRecords: readonly SearchRecord[],
  query: string,
  options: SearchBundleQueryOptions = {},
): readonly SearchRecord[] {
  const normalizedQuery = normalizeToken(query);
  if (normalizedQuery.length === 0) return [];

  const recordsById = new Map(
    searchRecords.map((record) => [record.id, record]),
  );
  const allowedKinds =
    options.kinds === undefined ? undefined : new Set(options.kinds);
  const matches = index.search(query, {
    boost: fieldBoosts,
    prefix: true,
    fuzzy: normalizedQuery.length >= 4 ? 0.2 : false,
  });

  return matches
    .map((match) => {
      const record = recordsById.get(String(match.id));
      if (record === undefined) return undefined;
      if (allowedKinds !== undefined && !allowedKinds.has(record.kind)) {
        return undefined;
      }
      return {
        record,
        score:
          match.score +
          (record.kind === "api" &&
          isExactApiSymbolMatch(record, query)
            ? exactApiSymbolBoost
            : 0),
      };
    })
    .filter(
      (entry): entry is { record: SearchRecord; score: number } =>
        entry !== undefined,
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        compareText(left.record.id, right.record.id),
    )
    .map(({ record }) => record);
}

/** A Node-side helper that restores a bundle, then uses the shared query path. */
export function searchSearchBundle(
  bundle: SerializedSearchBundle,
  query: string,
  options: SearchBundleQueryOptions = {},
): readonly SearchRecord[] {
  const index = MiniSearch.loadJSON<SearchRecord>(
    bundle.serializedSearchIndex,
    searchIndexOptions(),
  );
  return querySearchIndex(index, bundle.searchRecords, query, options);
}

function collectSearchRecords(
  input: SearchBundleInput,
): readonly SearchRecord[] {
  const records = [
    ...input.pages.flatMap(recordsForPage),
    ...input.examples.flatMap(recordsForExample),
  ].filter(isPublicSearchRecord);
  records.sort((left, right) => compareText(left.id, right.id));
  assertUniqueRecordIds(records);
  return records;
}

function recordsForPage(
  page: SearchBundleInput["pages"][number],
): readonly SearchRecord[] {
  const kind = kindForPage(page.route);
  const breadcrumb = breadcrumbForPage(page.route, page.frontmatter.typeDomain);
  const aliases = (page.frontmatter.aliases ?? []).join(" ");
  // Type-domain pages own their public symbols at individual anchored H2s.
  // Keeping those symbols off the domain root makes an exact type search land
  // on the canonical declaration rather than a generic category page.
  const symbols =
    page.frontmatter.apiCategory === "types"
      ? ""
      : (page.frontmatter.symbols ?? []).join(" ");
  const keywords = (page.frontmatter.keywords ?? []).join(" ");
  const root = {
    id: page.frontmatter.id,
    url: page.route,
    kind,
    title: page.frontmatter.title,
    breadcrumb,
    heading: page.frontmatter.title,
    summary: page.frontmatter.summary,
    symbols,
    aliases,
    keywords,
    body: page.plainText,
  } satisfies SearchRecord;
  const headings = page.sections
    // The root record already represents the H1 and all of its text. Emitting
    // an H1 record produces duplicate search destinations for the same page.
    .filter(({ heading }) => heading.level > 1)
    .map(({ heading, plainText }) => ({
    id: `${page.frontmatter.id}#${heading.id}`,
    url: `${page.route}#${heading.id}`,
    kind,
    title: page.frontmatter.title,
    breadcrumb,
    heading: heading.text,
    summary: page.frontmatter.summary,
    symbols: symbolsForHeading(page, heading),
    aliases: "",
    keywords,
    body: plainText,
    })) satisfies SearchRecord[];
  return [root, ...headings];
}

function recordsForExample(
  example: SearchBundleInput["examples"][number],
): readonly SearchRecord[] {
  if (example.browseGroup === undefined) return [];
  return [
    {
      id: `example:${example.slug}`,
      url: `#/examples/${example.browseGroup}/${example.slug}`,
      kind: "example",
      title: example.title,
      breadcrumb: `Examples > ${labelForBrowseGroup(example.browseGroup)}`,
      heading: example.shortTitle,
      summary: example.summary,
      symbols: "",
      aliases: "",
      keywords: example.api.join(" "),
      body: [...example.objectives, ...example.apiNotes].join("\n"),
    },
  ];
}

function kindForPage(route: string): Exclude<SearchKind, "example"> {
  return route === "#/api" || route.startsWith("#/api/") ? "api" : "learn";
}

function breadcrumbForPage(route: string, typeDomain?: string): string {
  if (route === "#/api") return "API";
  if (route.startsWith("#/api/components/")) return "API > Components";
  if (route.startsWith("#/api/functions/")) return "API > Functions";
  if (route.startsWith("#/api/hooks/")) return "API > Hooks";
  if (route.startsWith("#/api/types/")) {
    return `API > Types > ${labelForTypeDomain(typeDomain)}`;
  }
  if (route === "#/learn") return "Learn";
  if (route.startsWith("#/learn/tutorials/")) return "Learn > Tutorials";
  return "Learn > Guides";
}

function symbolsForHeading(
  page: SearchBundleInput["pages"][number],
  heading: PublicDocHeading,
): string {
  if (heading.level < 2) return "";
  return (page.frontmatter.symbols ?? []).includes(heading.text)
    ? heading.text
    : "";
}

function isPublicSearchRecord(record: SearchRecord): boolean {
  if (record.id.startsWith("internal:") || record.url.startsWith("#/testing")) {
    return false;
  }
  if (!publicSearchUrl.test(record.url)) {
    throw new Error(`Invalid public search URL "${record.url}".`);
  }
  return true;
}

function assertUniqueRecordIds(records: readonly SearchRecord[]): void {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) {
      throw new Error(`Duplicate public search record ID "${record.id}".`);
    }
    ids.add(record.id);
  }
}

function isExactApiSymbolMatch(
  record: SearchRecord,
  query: string,
): boolean {
  return [record.symbols, record.aliases].some((value) =>
    value
      .split(/[\s,]+/u)
      .filter((candidate) => candidate.length > 0)
      .some((candidate) => candidate === query),
  );
}

function normalizeToken(value: string): string {
  return value.toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]/gu, "");
}

function addToken(tokens: string[], seen: Set<string>, token: string): void {
  if (token.length === 0 || seen.has(token)) return;
  seen.add(token);
  tokens.push(token);
}

function labelForBrowseGroup(group: string): string {
  return group
    .split("-")
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function labelForTypeDomain(domain?: string): string {
  if (domain === undefined) return "Reference";
  return labelForBrowseGroup(domain).replace(
    "Elements Components",
    "Elements and components",
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
