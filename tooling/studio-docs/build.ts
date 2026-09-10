import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

import {
  collectPublicExports,
  crcPublicEntryPaths,
  validateApiCoverage,
  type ApiCoverage,
  type ApiCoverageDestination,
  type PublicApiInventory,
} from "./api-exports";
import { parsePublicMarkdown } from "./markdown";
import type { LoadedPublicDoc } from "./model";

const legacyRelativeAlias = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const legacyHashRoute =
  /^#\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/u;

export interface StudioDocumentationPage extends LoadedPublicDoc {
  readonly sourcePath: string;
  readonly aliases: readonly string[];
}

export interface StudioDocumentationExample {
  readonly slug: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly section: string;
  readonly browseGroup?: string;
  readonly summary: string;
  readonly api: readonly string[];
  readonly objectives: readonly string[];
  readonly apiNotes: readonly string[];
  readonly sourcePath: string;
}

export interface StudioDocumentationExampleInput {
  readonly slug: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly section: string;
  readonly browseGroup?: string;
  readonly summary: string;
  readonly api: readonly string[];
  readonly objectives: readonly string[];
  readonly apiNotes: readonly string[];
  readonly source: {
    readonly path: string;
  };
}

export interface SerializedApiCoverage {
  readonly values: Readonly<Record<string, ApiCoverageDestination>>;
  readonly types: Readonly<Record<string, ApiCoverageDestination>>;
  readonly overview: Readonly<Record<string, ApiCoverageDestination>>;
  readonly missingValues: readonly string[];
  readonly missingTypes: readonly string[];
  readonly unknownSymbols: readonly string[];
  readonly duplicateSymbols: ApiCoverage["duplicateSymbols"];
  readonly duplicateValues: readonly string[];
  readonly duplicateTypes: readonly string[];
}

export interface StudioDocumentationBuild {
  readonly pages: readonly StudioDocumentationPage[];
  readonly pageByRoute: Readonly<Record<string, StudioDocumentationPage>>;
  readonly legacyRouteToRoute: Readonly<Record<string, string>>;
  readonly examples: readonly StudioDocumentationExample[];
  readonly apiCoverage: SerializedApiCoverage;
}

/** The minimal public manifest projection used to generate the lazy search data. */
export interface StudioDocumentationSearchInput {
  readonly pages: readonly StudioDocumentationPage[];
  readonly examples: readonly StudioDocumentationExample[];
}

/** Browser rendering needs generated HTML and anchors, never search-only text. */
export type StudioDocumentationBrowserPage = Pick<
  StudioDocumentationPage,
  "frontmatter" | "route" | "html" | "headings"
>;

export interface StudioDocumentationBrowserBuild {
  readonly pages: readonly StudioDocumentationBrowserPage[];
  readonly pageByRoute: Readonly<
    Record<string, StudioDocumentationBrowserPage>
  >;
  readonly apiCoverage: SerializedApiCoverage;
}

export interface StudioDocumentationBuildOptions {
  readonly repositoryRoot: string;
  readonly docsDirectory?: string;
  readonly apiInventory?: PublicApiInventory;
  readonly examples?: readonly StudioDocumentationExampleInput[];
}

/**
 * Reads the only public documentation tree and returns a serializable manifest.
 * Every ordering decision is made before parsing so consumers receive stable
 * output regardless of filesystem enumeration order.
 */
export async function buildStudioDocumentation(
  options: StudioDocumentationBuildOptions,
): Promise<StudioDocumentationBuild> {
  const repositoryRoot = resolve(options.repositoryRoot);
  const docsDirectory = resolve(
    repositoryRoot,
    options.docsDirectory ?? "docs/site",
  );
  const sourcePaths = await discoverPublicMarkdownPaths(
    repositoryRoot,
    docsDirectory,
  );
  const pages = await Promise.all(
    sourcePaths.map(async (sourcePath) => {
      const source = await readFile(
        resolve(repositoryRoot, sourcePath),
        "utf8",
      );
      const parsed = parsePublicMarkdown(sourcePath, source);
      return {
        ...parsed,
        sourcePath,
        aliases: [...(parsed.frontmatter.aliases ?? [])].sort(compareText),
      } satisfies StudioDocumentationPage;
    }),
  );

  const examples = normalizeExamples(options.examples ?? []);
  validatePageIdentity(pages);
  const legacyRouteToRoute = validateRoutesAndAliases(pages);
  validateHeadingAnchors(pages);
  validateInternalLinks(
    pages,
    legacyRouteToRoute,
    examples,
    options.examples !== undefined,
  );
  validateTutorialOrder(pages);
  if (options.examples !== undefined)
    validateExampleReferences(pages, examples);

  const inventory =
    options.apiInventory ??
    (await collectPublicExports(crcPublicEntryPaths, {}));
  const apiCoverage = validateApiCoverage(
    inventory,
    pages
      .filter(({ frontmatter }) => frontmatter.kind === "api")
      .map(({ frontmatter, route }) => ({ frontmatter, route })),
  );
  validateRelatedTypeLinks(pages);
  return {
    pages,
    pageByRoute: recordFromEntries(pages.map((page) => [page.route, page])),
    legacyRouteToRoute,
    examples,
    apiCoverage: serializeApiCoverage(apiCoverage),
  };
}

export function toStudioDocumentationSearchInput(
  documentation: StudioDocumentationBuild,
): StudioDocumentationSearchInput {
  return {
    pages: documentation.pages,
    examples: documentation.examples,
  };
}

export function toStudioDocumentationBrowserBuild(
  documentation: StudioDocumentationBuild,
): StudioDocumentationBrowserBuild {
  const pages = documentation.pages.map(
    ({ frontmatter, route, html, headings }) => ({
      frontmatter,
      route,
      html,
      headings,
    }),
  );
  return {
    pages,
    pageByRoute: recordFromEntries(pages.map((page) => [page.route, page])),
    apiCoverage: documentation.apiCoverage,
  };
}

export async function discoverStudioDocumentationSourcePaths(
  options: Pick<
    StudioDocumentationBuildOptions,
    "repositoryRoot" | "docsDirectory"
  >,
): Promise<readonly string[]> {
  const repositoryRoot = resolve(options.repositoryRoot);
  return discoverPublicMarkdownPaths(
    repositoryRoot,
    resolve(repositoryRoot, options.docsDirectory ?? "docs/site"),
  );
}

async function discoverPublicMarkdownPaths(
  repositoryRoot: string,
  docsDirectory: string,
): Promise<readonly string[]> {
  const entries = await readdir(docsDirectory, { recursive: true }).catch(
    (error: unknown) => {
      if (isMissingDirectory(error)) return [] as string[];
      throw error;
    },
  );
  return entries
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) =>
      toRepositoryPath(repositoryRoot, resolve(docsDirectory, entry)),
    )
    .sort(compareText);
}

function isMissingDirectory(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function toRepositoryPath(repositoryRoot: string, path: string): string {
  const sourcePath = relative(repositoryRoot, path).replaceAll("\\", "/");
  if (sourcePath === ".." || sourcePath.startsWith("../")) {
    throw new Error(
      `Public documentation path escapes the repository: ${path}.`,
    );
  }
  return sourcePath;
}

function validatePageIdentity(pages: readonly StudioDocumentationPage[]): void {
  assertUnique(
    pages.map(({ frontmatter }) => frontmatter.id),
    "content ID",
  );
  assertUnique(
    pages.map(({ frontmatter }) => frontmatter.slug),
    "content slug",
  );
}

function validateRoutesAndAliases(
  pages: readonly StudioDocumentationPage[],
): Readonly<Record<string, string>> {
  assertUnique(
    pages.map(({ route }) => route),
    "canonical route",
  );
  const canonicalRoutes = new Set(pages.map(({ route }) => route));
  const aliases = new Map<string, string>();

  for (const page of pages) {
    for (const alias of page.aliases) {
      const route = routeForAlias(page, alias);
      if (canonicalRoutes.has(route)) {
        throw new Error(
          `Legacy alias "${route}" collides with a canonical route.`,
        );
      }
      const existing = aliases.get(route);
      if (existing !== undefined) {
        throw new Error(
          `Duplicate legacy alias "${route}" for "${existing}" and "${page.route}".`,
        );
      }
      aliases.set(route, page.route);
    }
  }

  return recordFromEntries([...aliases]);
}

function routeForAlias(page: StudioDocumentationPage, alias: string): string {
  if (alias.startsWith("#/")) {
    if (!legacyHashRoute.test(alias)) invalidLegacyAlias(page, alias);
    return alias;
  }
  if (!legacyRelativeAlias.test(alias)) invalidLegacyAlias(page, alias);
  const directory = page.route.slice(0, page.route.lastIndexOf("/") + 1);
  return `${directory}${alias}`;
}

function invalidLegacyAlias(
  page: StudioDocumentationPage,
  alias: string,
): never {
  throw new Error(
    `${page.sourcePath}: Invalid legacy alias "${alias}". Use a stable relative slug or an absolute hash route with stable path segments.`,
  );
}

function validateHeadingAnchors(
  pages: readonly StudioDocumentationPage[],
): void {
  for (const page of pages) {
    assertUnique(
      page.headings.map(({ id }) => id),
      `heading anchor in ${page.sourcePath}`,
    );
  }
}

function validateInternalLinks(
  pages: readonly StudioDocumentationPage[],
  legacyRouteToRoute: Readonly<Record<string, string>>,
  examples: readonly StudioDocumentationExample[],
  validatesExampleRoutes: boolean,
): void {
  const pageByRoute = new Map(pages.map((page) => [page.route, page]));
  const exampleRoutes = new Set(
    examples.flatMap(({ browseGroup, slug }) =>
      browseGroup === undefined ? [] : [`#/examples/${browseGroup}/${slug}`],
    ),
  );
  for (const page of pages) {
    for (const link of page.internalLinks) {
      const { route, anchor } = splitInternalLink(link.href);
      if (exampleRoutes.has(route)) {
        if (anchor !== undefined) {
          throw new Error(
            `Live example route "${route}" linked from ${page.sourcePath}#${link.sourceHeading} cannot have a documentation anchor.`,
          );
        }
        continue;
      }
      if (route.startsWith("#/examples/")) {
        if (!validatesExampleRoutes && isCanonicalExampleRoute(route)) {
          if (anchor !== undefined) {
            throw new Error(
              `Live example route "${route}" linked from ${page.sourcePath}#${link.sourceHeading} cannot have a documentation anchor.`,
            );
          }
          continue;
        }
        throw new Error(
          `Unknown live example route "${route}" linked from ${page.sourcePath}#${link.sourceHeading}.`,
        );
      }
      const canonicalRoute = legacyRouteToRoute[route] ?? route;
      const destination = pageByRoute.get(canonicalRoute);
      if (destination === undefined) {
        throw new Error(
          `Unknown internal route "${route}" linked from ${page.sourcePath}#${link.sourceHeading}.`,
        );
      }
      if (
        anchor !== undefined &&
        !destination.headings.some(({ id }) => id === anchor)
      ) {
        throw new Error(
          `Unknown internal anchor "${anchor}" on "${canonicalRoute}" linked from ${page.sourcePath}#${link.sourceHeading}.`,
        );
      }
    }
  }
}

function isCanonicalExampleRoute(route: string): boolean {
  return /^#\/examples\/(?:drawing|composition|layout|events-and-interaction|focus-and-keyboard)\/[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(
    route,
  );
}

function splitInternalLink(href: string): { route: string; anchor?: string } {
  const anchorIndex = href.indexOf("#", 2);
  if (anchorIndex === -1) return { route: href };
  return {
    route: href.slice(0, anchorIndex),
    anchor: href.slice(anchorIndex + 1),
  };
}

function validateTutorialOrder(
  pages: readonly StudioDocumentationPage[],
): void {
  const chaptersByTutorial = new Map<string, StudioDocumentationPage[]>();
  for (const page of pages) {
    const { frontmatter } = page;
    if (frontmatter.kind !== "tutorial") continue;
    if (frontmatter.tutorial === undefined) {
      throw new Error(
        `${page.sourcePath}: tutorial pages must identify a tutorial.`,
      );
    }
    if (frontmatter.slug === frontmatter.tutorial) continue;
    if (frontmatter.order === undefined) {
      throw new Error(
        `${page.sourcePath}: tutorial chapters must declare an order.`,
      );
    }
    const chapters = chaptersByTutorial.get(frontmatter.tutorial) ?? [];
    chapters.push(page);
    chaptersByTutorial.set(frontmatter.tutorial, chapters);
  }

  for (const [tutorial, chapters] of chaptersByTutorial) {
    const orders = chapters
      .map(({ frontmatter }) => frontmatter.order as number)
      .sort((a, b) => a - b);
    const expected = orders.map((_order, index) => index + 1);
    if (orders.some((order, index) => order !== expected[index])) {
      throw new Error(
        `Tutorial "${tutorial}" chapter order must be unique and contiguous from 1.`,
      );
    }
  }
}

function normalizeExamples(
  catalog: readonly StudioDocumentationExampleInput[],
): readonly StudioDocumentationExample[] {
  const examples = catalog.map(
    ({
      slug,
      title,
      shortTitle,
      section,
      browseGroup,
      summary,
      api,
      objectives,
      apiNotes,
      source,
    }) => ({
      slug,
      title,
      shortTitle,
      section,
      summary,
      api: [...api],
      objectives: [...objectives],
      apiNotes: [...apiNotes],
      sourcePath: source.path,
      ...(browseGroup === undefined ? {} : { browseGroup }),
    }),
  );
  assertUnique(
    examples.map(({ slug }) => slug),
    "example slug",
  );
  return examples.sort((left, right) => compareText(left.slug, right.slug));
}

function validateExampleReferences(
  pages: readonly StudioDocumentationPage[],
  examples: readonly StudioDocumentationExample[],
): void {
  const exampleSlugs = new Set(examples.map(({ slug }) => slug));
  for (const page of pages) {
    const slug = page.frontmatter.exampleSlug;
    if (slug !== undefined && !exampleSlugs.has(slug)) {
      throw new Error(
        `${page.sourcePath}: Unknown learning example "${slug}" referenced by exampleSlug.`,
      );
    }
  }
}

function validateRelatedTypeLinks(
  pages: readonly StudioDocumentationPage[],
): void {
  const destinations = new Map<string, string>();
  for (const page of pages) {
    if (page.frontmatter.apiCategory !== "types") continue;
    for (const symbol of page.frontmatter.symbols ?? []) {
      const heading = page.headings.find(
        ({ level, text }) => level === 2 && text === symbol,
      );
      if (heading === undefined) {
        throw new Error(
          `${page.sourcePath}: Type ${symbol} must have a matching level-two heading.`,
        );
      }
      const destination = `${page.route}#${heading.id}`;
      const existing = destinations.get(symbol);
      if (existing !== undefined && existing !== destination) {
        throw new Error(
          `Type ${symbol} has multiple grouped reference destinations: ${existing} and ${destination}.`,
        );
      }
      destinations.set(symbol, destination);
    }
  }

  for (const page of pages) {
    const relatedTypes = page.frontmatter.relatedTypes ?? [];
    assertUnique(
      relatedTypes,
      `related type declaration in ${page.sourcePath}`,
    );
    for (const type of relatedTypes) {
      const destination = destinations.get(type);
      if (destination === undefined) {
        throw new Error(
          `${page.sourcePath}: Related type ${type} has no grouped type reference destination.`,
        );
      }
      if (
        !page.internalLinks.some(
          ({ href, text }) => href === destination && text === type,
        )
      ) {
        throw new Error(
          `${page.sourcePath}: ${type} must link to ${destination}.`,
        );
      }
    }
  }
}

function serializeApiCoverage(coverage: ApiCoverage): SerializedApiCoverage {
  return {
    values: recordFromEntries([...coverage.values]),
    types: recordFromEntries([...coverage.types]),
    overview: recordFromEntries([...coverage.overview]),
    missingValues: coverage.missingValues,
    missingTypes: coverage.missingTypes,
    unknownSymbols: coverage.unknownSymbols,
    duplicateSymbols: coverage.duplicateSymbols,
    duplicateValues: coverage.duplicateValues,
    duplicateTypes: coverage.duplicateTypes,
  };
}

function assertUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label} "${value}".`);
    seen.add(value);
  }
}

function recordFromEntries<T>(
  entries: readonly (readonly [string, T])[],
): Readonly<Record<string, T>> {
  return Object.fromEntries(
    [...entries].sort(([left], [right]) => compareText(left, right)),
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
