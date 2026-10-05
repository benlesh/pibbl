/** The website and Studio use the same destination for each public document. */
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
