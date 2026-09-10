export type PublicDocKind = "landing" | "tutorial" | "guide" | "api";
export type ApiCategory =
  "overview" | "component" | "function" | "hook" | "types";
export type TypeDomain =
  | "canvas-runtime"
  | "elements-components"
  | "events"
  | "filters"
  | "layout"
  | "styles";

export interface PublicDocFrontmatter {
  readonly id: string;
  readonly title: string;
  readonly navLabel?: string;
  readonly summary: string;
  readonly kind: PublicDocKind;
  readonly slug: string;
  readonly order?: number;
  readonly tutorial?: "diagram-editor";
  readonly apiCategory?: ApiCategory;
  readonly typeDomain?: TypeDomain;
  readonly symbols?: readonly string[];
  /** Public type contracts named and linked by a runtime API page. */
  readonly relatedTypes?: readonly string[];
  readonly aliases?: readonly string[];
  readonly keywords?: readonly string[];
  readonly exampleSlug?: string;
}

export interface PublicDocHeading {
  readonly id: string;
  readonly level: number;
  readonly text: string;
}

export interface PublicDocInternalLink {
  readonly href: string;
  readonly sourceHeading: string;
  readonly text: string;
}

export interface LoadedPublicDoc {
  readonly frontmatter: PublicDocFrontmatter;
  readonly route: string;
  readonly html: string;
  readonly plainText: string;
  readonly headings: readonly PublicDocHeading[];
  readonly internalLinks: readonly PublicDocInternalLink[];
}

const documentKinds = new Set<PublicDocKind>([
  "landing",
  "tutorial",
  "guide",
  "api",
]);
const apiCategories = new Set<ApiCategory>([
  "overview",
  "component",
  "function",
  "hook",
  "types",
]);
const typeDomains = new Set<TypeDomain>([
  "canvas-runtime",
  "elements-components",
  "events",
  "filters",
  "layout",
  "styles",
]);
const stableSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function validatePublicDocFrontmatter(
  value: unknown,
  path: string,
): PublicDocFrontmatter {
  if (!isRecord(value)) {
    throw new Error(`${path}: frontmatter must be a mapping.`);
  }

  const kind = stringFrom(value, "kind", path);
  if (!documentKinds.has(kind as PublicDocKind)) {
    throw new Error(
      `${path}: kind must be one of ${[...documentKinds].join(", ")}.`,
    );
  }

  const slug = stringFrom(value, "slug", path);
  assertSlug(slug, "slug", path);

  const navLabel = optionalStringFrom(value, "navLabel", path);
  const order = optionalOrderFrom(value, path);
  const tutorial = optionalEnumFrom(
    value,
    "tutorial",
    ["diagram-editor"],
    path,
  );
  const apiCategory = optionalEnumFrom(
    value,
    "apiCategory",
    apiCategories,
    path,
  );
  const typeDomain = optionalEnumFrom(value, "typeDomain", typeDomains, path);
  const symbols = optionalStringArrayFrom(value, "symbols", path);
  const relatedTypes = optionalStringArrayFrom(value, "relatedTypes", path);
  const aliases = optionalStringArrayFrom(value, "aliases", path);
  const keywords = optionalStringArrayFrom(value, "keywords", path);
  const exampleSlug = optionalStringFrom(value, "exampleSlug", path);

  if (exampleSlug !== undefined) {
    assertSlug(exampleSlug, "exampleSlug", path);
  }

  return {
    id: stringFrom(value, "id", path),
    title: stringFrom(value, "title", path),
    summary: stringFrom(value, "summary", path),
    kind: kind as PublicDocKind,
    slug,
    ...(navLabel === undefined ? {} : { navLabel }),
    ...(order === undefined ? {} : { order }),
    ...(tutorial === undefined ? {} : { tutorial }),
    ...(apiCategory === undefined ? {} : { apiCategory }),
    ...(typeDomain === undefined ? {} : { typeDomain }),
    ...(symbols === undefined ? {} : { symbols }),
    ...(relatedTypes === undefined ? {} : { relatedTypes }),
    ...(aliases === undefined ? {} : { aliases }),
    ...(keywords === undefined ? {} : { keywords }),
    ...(exampleSlug === undefined ? {} : { exampleSlug }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringFrom(
  value: Record<string, unknown>,
  key: string,
  path: string,
): string {
  return optionalStringFrom(value, key, path) ?? missing(key, path);
}

function optionalStringFrom(
  value: Record<string, unknown>,
  key: string,
  path: string,
): string | undefined {
  const candidate = value[key];
  if (candidate === undefined) return undefined;
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    throw new Error(`${path}: ${key} must be a non-empty string.`);
  }
  return candidate;
}

function optionalOrderFrom(
  value: Record<string, unknown>,
  path: string,
): number | undefined {
  const candidate = value.order;
  if (candidate === undefined) return undefined;
  if (
    typeof candidate !== "number" ||
    !Number.isSafeInteger(candidate) ||
    candidate < 0
  ) {
    throw new Error(`${path}: order must be a non-negative safe integer.`);
  }
  return candidate;
}

function optionalEnumFrom<T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<T> | readonly T[],
  path: string,
): T | undefined {
  const candidate = value[key];
  if (candidate === undefined) return undefined;
  const values = Array.isArray(allowed) ? allowed : [...allowed];
  if (typeof candidate !== "string" || !values.includes(candidate as T)) {
    throw new Error(`${path}: ${key} must be one of ${values.join(", ")}.`);
  }
  return candidate as T;
}

function optionalStringArrayFrom(
  value: Record<string, unknown>,
  key: string,
  path: string,
): readonly string[] | undefined {
  const candidate = value[key];
  if (candidate === undefined) return undefined;
  if (
    !Array.isArray(candidate) ||
    candidate.some(
      (entry) => typeof entry !== "string" || entry.trim().length === 0,
    )
  ) {
    throw new Error(`${path}: ${key} must be an array of non-empty strings.`);
  }
  return candidate;
}

function assertSlug(value: string, key: string, path: string): void {
  if (!stableSlug.test(value)) {
    throw new Error(
      `${path}: ${key} must be lowercase words separated by single hyphens.`,
    );
  }
}

function missing(key: string, path: string): never {
  throw new Error(`${path}: ${key} is required.`);
}
