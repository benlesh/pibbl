import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

import {
  analyzeApiCoverage,
  collectPublicExports,
  crcPublicEntryPaths,
  type ApiCoverage,
  type ApiCoverageDestination,
  type PublicApiInventory,
} from "./api-exports";
import { parsePublicMarkdown } from "./markdown";
import type { LoadedPublicDoc } from "./model";

export interface StudioDocumentationPage extends LoadedPublicDoc {
  readonly sourcePath: string;
  readonly aliases: readonly string[];
}

export interface StudioDocumentationExample {
  readonly slug: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly section: string;
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

  validatePageIdentity(pages);
  const legacyRouteToRoute = validateRoutesAndAliases(pages);
  validateHeadingAnchors(pages);
  validateInternalLinks(pages, legacyRouteToRoute);
  validateTutorialOrder(pages);

  const examples = normalizeExamples(options.examples ?? []);
  validateExampleReferences(pages, examples);

  const inventory =
    options.apiInventory ??
    (await collectPublicExports(crcPublicEntryPaths, {}));
  const apiCoverage = analyzeApiCoverage(
    inventory,
    pages
      .filter(({ frontmatter }) => frontmatter.kind === "api")
      .map(({ frontmatter, route }) => ({ frontmatter, route })),
  );
  validateDocumentedApiSymbols(apiCoverage);

  return {
    pages,
    pageByRoute: recordFromEntries(pages.map((page) => [page.route, page])),
    legacyRouteToRoute,
    examples,
    apiCoverage: serializeApiCoverage(apiCoverage),
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
  if (alias.startsWith("#/")) return alias;
  const directory = page.route.slice(0, page.route.lastIndexOf("/") + 1);
  return `${directory}${alias}`;
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
): void {
  const pageByRoute = new Map(pages.map((page) => [page.route, page]));
  for (const page of pages) {
    for (const link of page.internalLinks) {
      const { route, anchor } = splitInternalLink(link.href);
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

function validateDocumentedApiSymbols(coverage: ApiCoverage): void {
  if (coverage.duplicateSymbols.length > 0) {
    throw new Error(
      `Duplicate documented API symbols: ${coverage.duplicateSymbols
        .map(({ symbol }) => symbol)
        .join(", ")}.`,
    );
  }
  if (coverage.unknownSymbols.length > 0) {
    throw new Error(
      `Unknown documented API symbols: ${coverage.unknownSymbols.join(", ")}.`,
    );
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
