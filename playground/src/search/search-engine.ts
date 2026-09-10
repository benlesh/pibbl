import MiniSearch from "minisearch";

import {
  querySearchIndex,
  searchIndexOptions,
  type SearchKind,
  type SearchRecord,
} from "../../../tooling/studio-docs/search-index";

export interface SearchBundle {
  readonly serializedSearchIndex: string;
  readonly searchRecords: readonly SearchRecord[];
}

export interface SearchHighlightRange {
  readonly start: number;
  readonly end: number;
}

export interface SearchExcerpt {
  readonly text: string;
  readonly matches: readonly SearchHighlightRange[];
}

export interface SearchResult extends SearchRecord {
  readonly excerpt: SearchExcerpt;
}

export interface SearchResponse {
  readonly results: readonly SearchResult[];
  readonly counts: Readonly<Record<SearchKind, number>>;
}

export interface SearchEngine {
  preload(): Promise<void>;
  search(query: string, kinds?: readonly SearchKind[]): Promise<SearchResponse>;
  retry(): Promise<void>;
}

export type SearchBundleLoader = () => Promise<SearchBundle>;

interface RestoredSearchIndex {
  readonly index: MiniSearch<SearchRecord>;
  readonly records: readonly SearchRecord[];
}

/**
 * Restores the build-generated index only after a visitor signals search intent.
 * The shared query helper keeps browser ranking identical to the build checks.
 */
export function createSearchEngine(loadBundle: SearchBundleLoader): SearchEngine {
  let loading: Promise<RestoredSearchIndex> | undefined;

  const restore = (): Promise<RestoredSearchIndex> => {
    if (loading !== undefined) return loading;
    loading = loadBundle()
      .then(({ serializedSearchIndex, searchRecords }) => ({
        index: MiniSearch.loadJSON<SearchRecord>(
          serializedSearchIndex,
          searchIndexOptions(),
        ),
        records: searchRecords,
      }))
      .catch((error: unknown) => {
        loading = undefined;
        throw error;
      });
    return loading;
  };

  return {
    async preload(): Promise<void> {
      await restore();
    },
    async search(
      query: string,
      kinds?: readonly SearchKind[],
    ): Promise<SearchResponse> {
      const restored = await restore();
      const allResults = querySearchIndex(
        restored.index,
        restored.records,
        query,
      );
      const counts = countKinds(allResults);
      const allowedKinds = kinds === undefined ? undefined : new Set(kinds);
      return {
        counts,
        results: allResults
          .filter(
            (record) =>
              allowedKinds === undefined || allowedKinds.has(record.kind),
          )
          .map((record) => ({ ...record, excerpt: createExcerpt(record, query) })),
      };
    },
    async retry(): Promise<void> {
      loading = undefined;
      await restore();
    },
  };
}

function countKinds(
  records: readonly SearchRecord[],
): Readonly<Record<SearchKind, number>> {
  const counts: Record<SearchKind, number> = { learn: 0, api: 0, example: 0 };
  for (const { kind } of records) counts[kind]++;
  return counts;
}

function createExcerpt(record: SearchRecord, query: string): SearchExcerpt {
  const source = record.body || record.summary || record.heading || record.title;
  const match = findMatch(source, query);
  const start = match === undefined ? 0 : Math.max(0, match.start - 72);
  const end = Math.min(source.length, Math.max(start + 180, (match?.end ?? 0) + 72));
  const prefix = start === 0 ? "" : "…";
  const suffix = end === source.length ? "" : "…";
  const text = `${prefix}${source.slice(start, end).replace(/\s+/gu, " ").trim()}${suffix}`;
  if (match === undefined || text.length === 0) return { text, matches: [] };

  const excerptOffset = prefix.length - start;
  const rangeStart = match.start + excerptOffset;
  const rangeEnd = match.end + excerptOffset;
  if (rangeStart < 0 || rangeEnd > text.length || rangeEnd <= rangeStart) {
    return { text, matches: [] };
  }
  return { text, matches: [{ start: rangeStart, end: rangeEnd }] };
}

function findMatch(
  source: string,
  query: string,
): SearchHighlightRange | undefined {
  const normalized = query.trim().toLocaleLowerCase("en-US");
  if (normalized.length === 0) return undefined;
  const lowerSource = source.toLocaleLowerCase("en-US");
  const direct = lowerSource.indexOf(normalized);
  if (direct !== -1) return { start: direct, end: direct + normalized.length };

  const token = normalized.match(/[\p{L}\p{N}]+/u)?.[0];
  if (token === undefined) return undefined;
  const index = lowerSource.indexOf(token);
  return index === -1 ? undefined : { start: index, end: index + token.length };
}
