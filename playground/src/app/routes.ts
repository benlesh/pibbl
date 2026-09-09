import {
  getLearningExampleBySlug,
  getLearningExampleLegacyRoutes,
  getLearningExampleRoute,
} from "@crc/scenarios";

const slug = "[a-z0-9]+(?:-[a-z0-9]+)*";
const documentRoute = new RegExp(
  `^#/(?:learn(?:/tutorials/${slug}(?:/${slug})?|/guides/${slug})?|api(?:/(?:components|functions|hooks)/${slug}|/types/${slug})?)$`,
  "u",
);
const exampleRoute = new RegExp(`^#/examples/(${slug})/(${slug})$`, "u");
const testRoute = new RegExp(`^#/testing/(${slug})$`, "u");
const legacyTestRoute = new RegExp(`^#/scenarios/(${slug})$`, "u");

export type ParsedStudioRoute =
  | DocumentStudioRoute
  | ExampleStudioRoute
  | ExamplesIndexStudioRoute
  | TestingStudioRoute
  | TestStudioRoute
  | UnknownStudioRoute;

export interface DocumentStudioRoute {
  readonly kind: "document";
  readonly route: string;
  readonly anchor?: string;
  readonly query?: string;
}

export interface ExampleStudioRoute {
  readonly kind: "example";
  readonly group: string;
  readonly slug: string;
  readonly query?: string;
}

export interface ExamplesIndexStudioRoute {
  readonly kind: "examples";
  readonly query?: string;
}

export interface TestingStudioRoute {
  readonly kind: "testing";
  readonly query?: string;
}

export interface TestStudioRoute {
  readonly kind: "test";
  readonly slug: string;
  readonly query?: string;
}

export interface UnknownStudioRoute {
  readonly kind: "unknown";
  readonly route: string;
  readonly anchor?: string;
  readonly query?: string;
}

export interface CanonicalRouteResult {
  readonly canonical: string;
  readonly changed: boolean;
  readonly route: ParsedStudioRoute;
}

/**
 * Parses only the stable, public Studio route grammar. This module intentionally
 * never reads or writes browser state so rendering and redirects can share it.
 */
export function parseStudioRoute(hash: string): ParsedStudioRoute {
  const { path, anchor, query } = splitHash(hash);
  const queryPart = query === "" ? {} : { query };

  if (path === "#/examples") return { kind: "examples", ...queryPart };
  if (path === "#/testing" || path === "#/scenarios") {
    return { kind: "testing", ...queryPart };
  }

  if (documentRoute.test(path)) {
    return {
      kind: "document",
      route: path,
      ...(anchor === "" ? {} : { anchor }),
      ...queryPart,
    };
  }

  const example = exampleRoute.exec(path);
  if (example) {
    return {
      kind: "example",
      group: example[1],
      slug: example[2],
      ...queryPart,
    };
  }

  const test = testRoute.exec(path) ?? legacyTestRoute.exec(path);
  if (test) return { kind: "test", slug: test[1], ...queryPart };

  return {
    kind: "unknown",
    route: path,
    ...(anchor === "" ? {} : { anchor }),
    ...queryPart,
  };
}

/** Serializes a parsed route without relying on the current browser location. */
export function routeHref(route: ParsedStudioRoute): string {
  switch (route.kind) {
    case "document":
      return `${route.route}${route.anchor === undefined ? "" : `#${route.anchor}`}${route.query ?? ""}`;
    case "example":
      return `#/examples/${route.group}/${route.slug}${route.query ?? ""}`;
    case "examples":
      return `#/examples${route.query ?? ""}`;
    case "testing":
      return `#/testing${route.query ?? ""}`;
    case "test":
      return `#/testing/${route.slug}${route.query ?? ""}`;
    case "unknown":
      return `${route.route}${route.anchor === undefined ? "" : `#${route.anchor}`}${route.query ?? ""}`;
  }
}

/**
 * Resolves data-owned legacy aliases to their stable public destination while
 * preserving a learning example's share query unchanged.
 */
export function canonicalizeHash(hash: string): CanonicalRouteResult {
  const parsed = parseStudioRoute(hash);
  let canonical = routeHref(parsed);

  if (parsed.kind === "example") {
    const entry = getLearningExampleBySlug(parsed.slug);
    const incoming = `#/examples/${parsed.group}/${parsed.slug}`;
    if (entry && getLearningExampleLegacyRoutes(entry).includes(incoming)) {
      canonical = `${getLearningExampleRoute(entry)}${parsed.query ?? ""}`;
    }
  }

  return {
    canonical,
    changed: canonical !== hash,
    route: parseStudioRoute(canonical),
  };
}

function splitHash(hash: string): {
  readonly path: string;
  readonly anchor: string;
  readonly query: string;
} {
  const hashStart = hash.startsWith("#") ? hash : `#${hash}`;
  const queryIndex = hashStart.indexOf("?");
  const beforeQuery =
    queryIndex === -1 ? hashStart : hashStart.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : hashStart.slice(queryIndex);
  const anchorIndex = beforeQuery.indexOf("#", 1);
  return {
    path: anchorIndex === -1 ? beforeQuery : beforeQuery.slice(0, anchorIndex),
    anchor: anchorIndex === -1 ? "" : beforeQuery.slice(anchorIndex + 1),
    query,
  };
}
