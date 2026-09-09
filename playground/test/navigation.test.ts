import { describe, expect, it } from "vitest";

import {
  activeNavigationIds,
  buildNavigation,
  type NavigationDocumentation,
} from "../src/app/navigation";
import { parseStudioRoute } from "../src/app/routes";

const documentation = {
  pages: [
    page("learn", "Learn", "landing"),
    page("tutorial", "Learn the basics", "tutorial", {
      tutorial: "diagram-editor",
      order: 10,
    }),
    page("guide-state", "Manage state and lifecycle", "guide", { order: 60 }),
    page("guide-jsx", "Configure JSX", "guide", { order: 10 }),
    page("api-overview", "API overview", "api", { apiCategory: "overview" }),
    page("component-text", "Text", "api", { apiCategory: "component" }),
    page("component-absolute", "Absolute", "api", { apiCategory: "component" }),
    page("function-crc", "crc", "api", { apiCategory: "function" }),
    page("function-create-element", "createElement", "api", { apiCategory: "function" }),
    page("hook-state", "crcState", "api", { apiCategory: "hook" }),
    page("hook-memo", "crcMemo", "api", { apiCategory: "hook" }),
    page("types-canvas", "Canvas and runtime", "api", {
      apiCategory: "types",
      typeDomain: "canvas-runtime",
    }),
    page("types-elements", "Elements and components", "api", {
      apiCategory: "types",
      typeDomain: "elements-components",
    }),
    page("types-events", "Events", "api", {
      apiCategory: "types",
      typeDomain: "events",
    }),
    page("types-filters", "Filters", "api", {
      apiCategory: "types",
      typeDomain: "filters",
    }),
    page("types-layout", "Layout", "api", {
      apiCategory: "types",
      typeDomain: "layout",
    }),
    page("types-styles", "Styles", "api", {
      apiCategory: "types",
      typeDomain: "styles",
    }),
  ],
} satisfies NavigationDocumentation;

const examples = [
  example("filters", "Filters", "drawing"),
  example("rectangle", "Rectangle", "drawing"),
  example("group", "Group", "composition"),
  example("flex", "Flex", "layout"),
  example("click", "Click", "events-and-interaction"),
  example("focus-management", "Focus management", "focus-and-keyboard"),
];

describe("Studio navigation", () => {
  const navigation = buildNavigation(documentation, examples);

  it("orders the primary public areas as Learn, API, and Examples", () => {
    expect(navigation.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "learn", label: "Learn" },
      { id: "api", label: "API" },
      { id: "examples", label: "Examples" },
    ]);
  });

  it("keeps tutorials before shallow curated guides", () => {
    const learn = navigation[0];

    expect(learn.children?.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "learn-tutorials", label: "Tutorials" },
      { id: "learn-guides", label: "Guides" },
    ]);
    expect(learn.children?.[1]?.children?.map(({ label }) => label)).toEqual([
      "Configure JSX",
      "Manage state and lifecycle",
    ]);
  });

  it("groups API pages with alphabetical leaves and six type domains", () => {
    const api = navigation[1];
    expect(api.children?.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "api-overview", label: "Overview" },
      { id: "api-components", label: "Components" },
      { id: "api-functions", label: "Functions" },
      { id: "api-hooks", label: "Hooks" },
      { id: "api-types", label: "Types" },
    ]);
    expect(api.children?.[1]?.children?.map(({ label }) => label)).toEqual([
      "Absolute",
      "Text",
    ]);
    expect(api.children?.[2]?.children?.map(({ label }) => label)).toEqual([
      "crc",
      "createElement",
    ]);
    expect(api.children?.[3]?.children?.map(({ label }) => label)).toEqual([
      "crcMemo",
      "crcState",
    ]);
    expect(api.children?.[4]?.children?.map(({ label }) => label)).toEqual([
      "Canvas and runtime",
      "Elements and components",
      "Events",
      "Filters",
      "Layout",
      "Styles",
    ]);
  });

  it("uses the five public example groups and excludes automated test labs", () => {
    const examplesArea = navigation[2];

    expect(examplesArea.children?.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "examples-drawing", label: "Drawing" },
      { id: "examples-composition", label: "Composition" },
      { id: "examples-layout", label: "Layout" },
      { id: "examples-events-and-interaction", label: "Events and interaction" },
      { id: "examples-focus-and-keyboard", label: "Focus and keyboard" },
    ]);
    expect(examplesArea.children?.[0]?.children?.map(({ label }) => label)).toEqual([
      "Filters",
      "Rectangle",
    ]);
    expect(JSON.stringify(navigation)).not.toContain("test");
  });

  it("marks the active page and each visible ancestor", () => {
    expect([...activeNavigationIds(parseStudioRoute("#/api/types/events"))]).toEqual([
      "api",
      "api-types",
      "api-types-events",
      "document:#/api/types/events",
    ]);
    expect([
      ...activeNavigationIds(
        parseStudioRoute("#/examples/drawing/filters"),
      ),
    ]).toEqual([
      "examples",
      "examples-drawing",
      "example:filters",
    ]);
  });
});

function page(
  id: string,
  title: string,
  kind: "landing" | "tutorial" | "guide" | "api",
  extra: Record<string, unknown> = {},
) {
  const route =
    kind === "landing"
      ? "#/learn"
      : kind === "tutorial"
        ? "#/learn/tutorials/diagram-editor"
        : kind === "guide"
          ? `#/learn/guides/${id.replace("guide-", "")}`
          : id === "api-overview"
            ? "#/api"
            : `#/api/${String(extra.apiCategory)}s/${id}`;
  return {
    route,
    frontmatter: {
      id,
      title,
      summary: title,
      kind,
      slug: id,
      ...extra,
    },
  };
}

function example(
  slug: string,
  title: string,
  browseGroup:
    | "drawing"
    | "composition"
    | "layout"
    | "events-and-interaction"
    | "focus-and-keyboard",
) {
  return { slug, title, shortTitle: title, browseGroup };
}
