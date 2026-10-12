import { describe, expect, it } from "vitest";

import {
  activeNavigationIds,
  buildNavigation,
  createNavigationState,
  navigationStorageKey,
  type NavigationDocumentation,
} from "../src/app/navigation";
import { parseStudioRoute } from "../src/app/routes";

const documentation = {
  pages: [
    page("learn", "Learn", "landing"),
    page("diagram-editor", "Learn the basics", "tutorial", {
      tutorial: "diagram-editor",
      order: 10,
    }),
    page("first-scene", "Create a scene", "tutorial", {
      tutorial: "diagram-editor",
      order: 20,
      route: "#/learn/tutorials/diagram-editor/first-scene",
    }),
    page("animation-basics", "Animate a scene", "tutorial", {
      tutorial: "animation-basics",
      order: 5,
      route: "#/learn/tutorials/animation-basics",
    }),
    page("timeline", "Build a timeline", "tutorial", {
      tutorial: "animation-basics",
      order: 10,
      route: "#/learn/tutorials/animation-basics/timeline",
    }),
    page("guide-state", "Manage state and lifecycle", "guide", { order: 60 }),
    page("guide-jsx", "Configure JSX", "guide", { order: 10 }),
    page("api-overview", "API overview", "api", { apiCategory: "overview" }),
    page("component-text", "Text", "api", { apiCategory: "component" }),
    page("component-absolute", "Absolute", "api", { apiCategory: "component" }),
    page("function-pibbl", "pibbl", "api", { apiCategory: "function" }),
    page("function-create-element", "createElement", "api", { apiCategory: "function" }),
    page("hook-signal", "useSignal", "api", { apiCategory: "hook" }),
    page("hook-computed", "useComputed", "api", { apiCategory: "hook" }),
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
    page("types-three", "Three.js integration types", "api", {
      apiCategory: "types",
      typeDomain: "three",
    }),
  ],
} satisfies NavigationDocumentation;

const examples = [
  example("filters", "Filters", "drawing"),
  example("rectangle", "Rectangle", "drawing"),
  example("group", "Group", "composition"),
  example("three-layer", "Three layer", "three"),
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
    expect(learn.children?.[0]?.children?.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: "Animate a scene", href: "#/learn/tutorials/animation-basics" },
      { label: "Learn the basics", href: "#/learn/tutorials/diagram-editor" },
    ]);
  });

  it("groups API pages with alphabetical leaves and their type domains", () => {
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
      "createElement",
      "pibbl",
    ]);
    expect(api.children?.[3]?.children?.map(({ label }) => label)).toEqual([
      "useComputed",
      "useSignal",
    ]);
    expect(api.children?.[4]?.children?.map(({ label }) => label)).toEqual([
      "State machines",
      "Sprites",
      "Canvas and runtime",
      "Elements and components",
      "Events",
      "Filters",
      "Layout",
      "Particles",
      "Styles",
      "Three.js",
    ]);
    expect(api.children?.[4]?.children?.map(({ href }) => href)).toEqual([
      "#/api/types/machines",
      "#/api/types/sprites",
      "#/api/types/canvas-runtime",
      "#/api/types/elements-components",
      "#/api/types/events",
      "#/api/types/filters",
      "#/api/types/layout",
      "#/api/types/particles",
      "#/api/types/styles",
      "#/api/types/three",
    ]);
  });

  it("uses the six public example groups and excludes automated test labs", () => {
    const examplesArea = navigation[2];

    expect(examplesArea.children?.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "examples-drawing", label: "Drawing" },
      { id: "examples-composition", label: "Composition" },
      { id: "examples-three", label: "Three.js" },
      { id: "examples-layout", label: "Layout" },
      { id: "examples-events-and-interaction", label: "Events and interaction" },
      { id: "examples-focus-and-keyboard", label: "Focus and keyboard" },
    ]);
    expect(examplesArea.children?.[0]?.children?.map(({ label }) => label)).toEqual([
      "Filters",
      "Rectangle",
    ]);
    expect(examplesArea.children?.[2]?.children?.map(({ label }) => label)).toEqual([
      "Three layer",
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

  it("persists collapsed preferences while active ancestors stay expanded", () => {
    const storage = memoryStorage();
    storage.setItem(
      navigationStorageKey,
      JSON.stringify({ api: false, "api-types": false }),
    );

    const state = createNavigationState({
      storage,
      activeRoute: parseStudioRoute("#/api/types/events"),
    });

    expect(state.isExpanded("api")).toBe(true);
    expect(state.isExpanded("api-types")).toBe(true);
    expect(state.isExpanded("examples")).toBe(false);

    state.toggle("api");
    expect(state.isExpanded("api")).toBe(true);
    expect(createNavigationState({ storage }).isExpanded("api")).toBe(false);

    state.toggle("examples");
    expect(state.isExpanded("examples")).toBe(true);
    expect(
      createNavigationState({ storage }).isExpanded("examples"),
    ).toBe(true);
  });

  it("treats malformed persisted navigation state as empty preferences", () => {
    const storage = memoryStorage();
    storage.setItem(navigationStorageKey, "not JSON");

    const state = createNavigationState({ storage });

    expect(state.isExpanded("api")).toBe(false);
    expect(() => state.toggle("api")).not.toThrow();
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
        ? String(extra.route ?? `#/learn/tutorials/${id}`)
        : kind === "guide"
          ? `#/learn/guides/${id.replace("guide-", "")}`
          : id === "api-overview"
            ? "#/api"
            : extra.apiCategory === "types"
              ? `#/api/types/${String(extra.typeDomain)}`
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
    | "three"
    | "layout"
    | "events-and-interaction"
    | "focus-and-keyboard",
) {
  return { slug, title, shortTitle: title, browseGroup };
}

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}
