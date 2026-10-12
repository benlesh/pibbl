/** The website and Studio use the same destination for each public document. */
export function resolveWebsiteLegacyHash(hash: string, routes: Readonly<Record<string, string>>): string | undefined {
  const end = hash.slice(1).search(/[?#]/);
  const route = end < 0 ? hash : hash.slice(0, end + 1);
  const destination = routes[route];
  if (destination === undefined) return undefined;
  const suffix = hash.slice(route.length);
  // Studio document hashes placed the query after the heading fragment.
  // Example shares keep that query inside their hash-based editor route.
  if (!destination.includes("#") && suffix.startsWith("#") && suffix.includes("?")) {
    const query = suffix.indexOf("?");
    return destination + suffix.slice(query) + suffix.slice(0, query);
  }
  return destination + suffix;
}

export function websiteDocumentId(studioRoute: string): string {
  if (studioRoute === "#/learn") return "guides/learning-path";
  if (studioRoute === "#/api") return "reference/overview";
  if (studioRoute.startsWith("#/learn/guides/")) {
    return `guides/${studioRoute.slice("#/learn/guides/".length)}`;
  }
  if (studioRoute.startsWith("#/learn/tutorials/")) {
    return `guides/tutorials/${studioRoute.slice("#/learn/tutorials/".length)}`;
  }
  if (studioRoute.startsWith("#/api/")) {
    return `reference/${studioRoute.slice("#/api/".length)}`;
  }
  throw new Error(`Unknown public documentation route: ${studioRoute}`);
}

export function websiteUrlForStudioDocument(hash: string, base: string): string {
  const queryIndex = hash.indexOf("?");
  const beforeQuery = queryIndex === -1 ? hash : hash.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : hash.slice(queryIndex);
  const anchorIndex = beforeQuery.indexOf("#", 1);
  const route = anchorIndex === -1 ? beforeQuery : beforeQuery.slice(0, anchorIndex);
  const anchor = anchorIndex === -1 ? "" : beforeQuery.slice(anchorIndex + 1);
  const destination = new URL(`${websiteDocumentId(route)}/`, base);
  destination.search = query;
  destination.hash = anchor;
  return destination.href;
}
