import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";

const CODE_VERSION = "v1.";
export const MAX_SHARED_URL_LENGTH = 16_000;

export interface SharedCodeResult {
  code: string;
  issue?: string;
}

export interface EncodedRouteResult {
  url: string;
  tooLong: boolean;
}

function routeParts(hash: string): { path: string; query: URLSearchParams } {
  const [path, query = ""] = hash.split("?", 2);
  return { path, query: new URLSearchParams(query) };
}

export function readSharedCode(
  hash: string,
  canonicalSource: string,
): SharedCodeResult {
  const payload = routeParts(hash).query.get("code");
  if (!payload) return { code: canonicalSource };
  if (!payload.startsWith(CODE_VERSION)) {
    return {
      code: canonicalSource,
      issue:
        "This shared edit uses an unsupported version, so the original lesson was restored.",
    };
  }
  try {
    const encoded = payload.slice(CODE_VERSION.length);
    if (!encoded || !/^[A-Za-z0-9+$-]+$/u.test(encoded)) {
      throw new Error("Invalid compressed source.");
    }
    const code = decompressFromEncodedURIComponent(encoded);
    if (code === null) throw new Error("Invalid compressed source.");
    return { code };
  } catch {
    return {
      code: canonicalSource,
      issue:
        "The shared edit could not be decoded, so the original lesson was restored.",
    };
  }
}

export function encodeCodeRoute(
  hash: string,
  code: string,
  canonicalSource: string,
): EncodedRouteResult {
  const { path } = routeParts(hash);
  const compressed = encodeURIComponent(compressToEncodedURIComponent(code));
  const route =
    code === canonicalSource
      ? path
      : `${path}?code=${CODE_VERSION}${compressed}`;
  const url = `${window.location.href.split("#", 1)[0]}${route}`;
  return { url, tooLong: url.length > MAX_SHARED_URL_LENGTH };
}

export function replaceCodeRoute(
  hash: string,
  code: string,
  canonicalSource: string,
): EncodedRouteResult {
  const result = encodeCodeRoute(hash, code, canonicalSource);
  if (!result.tooLong) window.history.replaceState(null, "", result.url);
  return result;
}
