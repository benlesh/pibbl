import type {
  ApiCategory,
  PublicDocFrontmatter,
  TypeDomain,
} from "../../../tooling/studio-docs/model";
import type { LearningBrowseGroup } from "@crc/scenarios";

import type { ParsedStudioRoute } from "./routes";

const collator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

const exampleGroups = [
  ["drawing", "Drawing"],
  ["composition", "Composition"],
  ["layout", "Layout"],
  ["events-and-interaction", "Events and interaction"],
  ["focus-and-keyboard", "Focus and keyboard"],
] as const satisfies readonly [LearningBrowseGroup, string][];

const typeDomains = [
  ["canvas-runtime", "Canvas and runtime"],
  ["elements-components", "Elements and components"],
  ["events", "Events"],
  ["filters", "Filters"],
  ["layout", "Layout"],
  ["styles", "Styles"],
] as const satisfies readonly [TypeDomain, string][];

export interface NavigationEntry {
  readonly id: string;
  readonly label: string;
  readonly href?: string;
  readonly children?: readonly NavigationEntry[];
}

export interface NavigationArea extends NavigationEntry {
  readonly id: "learn" | "api" | "examples";
}

export interface NavigationPage {
  readonly route: string;
  readonly frontmatter: Pick<
    PublicDocFrontmatter,
    | "id"
    | "slug"
    | "title"
    | "navLabel"
    | "kind"
    | "order"
    | "tutorial"
    | "apiCategory"
    | "typeDomain"
  >;
}

export interface NavigationDocumentation {
  readonly pages: readonly NavigationPage[];
}

export interface NavigationExample {
  readonly slug: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly browseGroup?: LearningBrowseGroup;
}

/** Builds the public Learn, API, and Examples hierarchy from validated data. */
export function buildNavigation(
  documentation: NavigationDocumentation,
  examples: readonly NavigationExample[],
): readonly NavigationArea[] {
  return [
    {
      id: "learn",
      label: "Learn",
      href: "#/learn",
      children: [
        group("learn-tutorials", "Tutorials", tutorialEntries(documentation.pages)),
        group("learn-guides", "Guides", guideEntries(documentation.pages)),
      ],
    },
    {
      id: "api",
      label: "API",
      href: "#/api",
      children: [
        overviewEntry(documentation.pages),
        group(
          "api-components",
          "Components",
          apiEntries(documentation.pages, "component"),
        ),
        group(
          "api-functions",
          "Functions",
          apiEntries(documentation.pages, "function"),
        ),
        group("api-hooks", "Hooks", apiEntries(documentation.pages, "hook")),
        {
          id: "api-types",
          label: "Types",
          children: typeDomains.map(([domain, label]) => typeDomainEntry(
            documentation.pages,
            domain,
            label,
          )),
        },
      ],
    },
    {
      id: "examples",
      label: "Examples",
      href: "#/examples",
      children: exampleGroups.map(([browseGroup, label]) => ({
        id: `examples-${browseGroup}`,
        label,
        children: examples
          .filter((entry) => entry.browseGroup === browseGroup)
          .slice()
          .sort(compareExample)
          .map((entry) => ({
            id: `example:${entry.slug}`,
            label: entry.shortTitle,
            href: `#/examples/${browseGroup}/${entry.slug}`,
          })),
      })),
    },
  ];
}

/** Returns every sidebar item that must be expanded to expose a route. */
export function activeNavigationIds(route: ParsedStudioRoute): ReadonlySet<string> {
  const ids = new Set<string>();
  if (route.kind === "example") {
    ids.add("examples");
    ids.add(`examples-${route.group}`);
    ids.add(`example:${route.slug}`);
    return ids;
  }
  if (route.kind !== "document") return ids;

  if (route.route === "#/learn") {
    ids.add("learn");
  } else if (route.route.startsWith("#/learn/tutorials/")) {
    ids.add("learn");
    ids.add("learn-tutorials");
    ids.add(`document:${route.route}`);
  } else if (route.route.startsWith("#/learn/guides/")) {
    ids.add("learn");
    ids.add("learn-guides");
    ids.add(`document:${route.route}`);
  } else if (route.route === "#/api") {
    ids.add("api");
    ids.add("api-overview");
  } else if (route.route.startsWith("#/api/types/")) {
    const domain = route.route.slice("#/api/types/".length);
    ids.add("api");
    ids.add("api-types");
    ids.add(`api-types-${domain}`);
    ids.add(`document:${route.route}`);
  } else {
    const category = apiCategoryFromRoute(route.route);
    if (category) {
      ids.add("api");
      ids.add(`api-${category}s`);
      ids.add(`document:${route.route}`);
    }
  }
  return ids;
}

function tutorialEntries(pages: readonly NavigationPage[]): readonly NavigationEntry[] {
  return pages
    .filter(
      ({ frontmatter }) =>
        frontmatter.kind === "tutorial" &&
        frontmatter.slug === frontmatter.tutorial,
    )
    .slice()
    .sort(compareCuratedPage)
    .map(toDocumentEntry);
}

function guideEntries(pages: readonly NavigationPage[]): readonly NavigationEntry[] {
  return pages
    .filter(({ frontmatter }) => frontmatter.kind === "guide")
    .slice()
    .sort(compareCuratedPage)
    .map(toDocumentEntry);
}

function apiEntries(
  pages: readonly NavigationPage[],
  category: Exclude<ApiCategory, "overview" | "types">,
): readonly NavigationEntry[] {
  return pages
    .filter(({ frontmatter }) => frontmatter.apiCategory === category)
    .slice()
    .sort(compareDisplayPage)
    .map(toDocumentEntry);
}

function overviewEntry(pages: readonly NavigationPage[]): NavigationEntry {
  const page = pages.find(({ frontmatter }) => frontmatter.apiCategory === "overview");
  return page === undefined
    ? { id: "api-overview", label: "Overview", href: "#/api" }
    : { ...toDocumentEntry(page), id: "api-overview", label: "Overview" };
}

function typeDomainEntry(
  pages: readonly NavigationPage[],
  domain: TypeDomain,
  label: string,
): NavigationEntry {
  const page = pages.find(({ frontmatter }) => frontmatter.typeDomain === domain);
  return {
    id: `api-types-${domain}`,
    label,
    href: page?.route ?? `#/api/types/${domain}`,
  };
}

function group(
  id: string,
  label: string,
  children: readonly NavigationEntry[],
): NavigationEntry {
  return { id, label, children };
}

function toDocumentEntry(page: NavigationPage): NavigationEntry {
  return {
    id: `document:${page.route}`,
    label: displayLabel(page),
    href: page.route,
  };
}

function displayLabel(page: NavigationPage): string {
  return page.frontmatter.navLabel ?? page.frontmatter.title;
}

function compareCuratedPage(left: NavigationPage, right: NavigationPage): number {
  return (
    (left.frontmatter.order ?? Number.MAX_SAFE_INTEGER) -
      (right.frontmatter.order ?? Number.MAX_SAFE_INTEGER) ||
    compareDisplayPage(left, right)
  );
}

function compareDisplayPage(left: NavigationPage, right: NavigationPage): number {
  return collator.compare(displayLabel(left), displayLabel(right));
}

function compareExample(left: NavigationExample, right: NavigationExample): number {
  return collator.compare(left.shortTitle, right.shortTitle);
}

function apiCategoryFromRoute(route: string): "component" | "function" | "hook" | undefined {
  if (route.startsWith("#/api/components/")) return "component";
  if (route.startsWith("#/api/functions/")) return "function";
  if (route.startsWith("#/api/hooks/")) return "hook";
  return undefined;
}
