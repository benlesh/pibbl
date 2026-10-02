import {
  RESPONSIVE_STYLE_ACTIONS,
  type ResponsiveStylesState,
} from "./responsive-styles-lab.example";
import type { SmokeScenarioState } from "./smoke.example";
import type { CleanupStressState } from "./cleanup-stress.example";
import type { DrawingCompositionState } from "./drawing-composition.example";
import type { DrawingImagesState } from "./drawing-images.example";
import type { DrawingLinesState } from "./drawing-lines.example";
import type { DrawingShapesState } from "./drawing-shapes.example";
import type { DrawingTextState } from "./drawing-text.example";
import type { GeometryMatrixState } from "./geometry-matrix.example";
import {
  FOCUS_NAVIGATION_SOURCE_ID,
  type FocusNavigationState,
} from "./focus-navigation.example";
import type { InteractionLabState } from "./interaction-lab.example";
import type { AgentTargetingState } from "./agent-targeting-verification";
import type { LifecycleLabState } from "./lifecycle-lab.example";
import type { LayoutFoundationState } from "./layout-foundation.example";
import type { MouseContractScenarioState } from "./mouse-contract.example";
import type { PerformanceLabState } from "./performance-lab.example";
import type { RuntimeHooksState } from "./runtime-hooks.example";
import type { CanvasSurfaceState } from "./canvas-surface.example";
import type { FilterLabState } from "./filter-lab.example";
import type { SignalsLabState } from "./signals-lab.example";
import type { AnimationLabState } from "./animation-lab.example";
import type { ManipulationLabState } from "./manipulation-lab.example";
import { MANIPULATION_LAB_ACTION_IDS } from "./manipulation-lab";
import type { ParticleCelebrationLabState } from "./particle-celebration-lab.example";
import type { ThreeInstancingLabState } from "./three-instancing-lab.example";
import type { Physics2DLabState } from "./physics-2d-lab.example";
import { GEOMETRY_MATRIX_CASES } from "./geometry-matrix.example";
import { MOUSE_CONTRACT_CASES } from "./mouse-contract";
import { PERFORMANCE_WORKLOADS } from "./performance-lab.example";
import type {
  ScenarioCatalogGroup,
  ScenarioCatalogIndex,
  ScenarioCatalogEntry,
  ScenarioCatalogRecord,
  ScenarioDefinition,
  ScenarioMetadata,
} from "./types";
import type { AnyScenarioCatalogEntry } from "./types";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VISIBILITIES = new Set(["documentation-candidate", "test-laboratory"]);
const MATURITIES = new Set([
  "baseline",
  "characterization",
  "contract",
  "trusted",
]);

function assertNonEmpty(
  value: string,
  field: string,
  scenarioId: string,
): void {
  if (!value.trim()) {
    throw new Error(`Scenario "${scenarioId}" has an empty ${field}.`);
  }
}

function validateMetadata(metadata: ScenarioMetadata): void {
  assertNonEmpty(metadata.id, "id", metadata.id || "<unknown>");
  assertNonEmpty(metadata.slug, "slug", metadata.id);
  assertNonEmpty(metadata.title, "title", metadata.id);
  assertNonEmpty(metadata.summary, "summary", metadata.id);
  assertNonEmpty(metadata.category, "category", metadata.id);
  assertNonEmpty(metadata.visibilityReason, "visibilityReason", metadata.id);
  if (!Number.isInteger(metadata.learningOrder) || metadata.learningOrder < 1) {
    throw new Error(
      `Scenario "${metadata.id}" must use a positive learningOrder.`,
    );
  }

  if (!ID_PATTERN.test(metadata.id) || !ID_PATTERN.test(metadata.slug)) {
    throw new Error(
      `Scenario "${metadata.id}" must use kebab-case id and slug values.`,
    );
  }
  if (!VISIBILITIES.has(metadata.visibility)) {
    throw new Error(`Scenario "${metadata.id}" has an unsupported visibility.`);
  }
  if (!MATURITIES.has(metadata.maturity)) {
    throw new Error(`Scenario "${metadata.id}" has an unsupported maturity.`);
  }
  if (!metadata.apiTags.length || !metadata.conceptTags.length) {
    throw new Error(
      `Scenario "${metadata.id}" must provide API and concept tags.`,
    );
  }
  if (!metadata.manualSteps.length) {
    throw new Error(`Scenario "${metadata.id}" must provide manual steps.`);
  }
  if (!metadata.knownLimitations.length) {
    throw new Error(
      `Scenario "${metadata.id}" must declare known limitations.`,
    );
  }

  for (const [index, step] of metadata.manualSteps.entries()) {
    assertNonEmpty(step.action, `manualSteps[${index}].action`, metadata.id);
    assertNonEmpty(
      step.expected,
      `manualSteps[${index}].expected`,
      metadata.id,
    );
  }
  for (const [index, tag] of metadata.apiTags.entries()) {
    assertNonEmpty(tag, `apiTags[${index}]`, metadata.id);
  }
  for (const [index, tag] of metadata.conceptTags.entries()) {
    assertNonEmpty(tag, `conceptTags[${index}]`, metadata.id);
  }
  for (const [index, limitation] of metadata.knownLimitations.entries()) {
    assertNonEmpty(limitation, `knownLimitations[${index}]`, metadata.id);
  }
}

function sameValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function validateScenarioCatalog<
  TCatalog extends readonly ScenarioCatalogRecord[],
>(catalog: TCatalog): TCatalog {
  const ids = new Set<string>();
  const learningOrders = new Set<number>();
  const slugs = new Set<string>();
  const sourceIds = new Set<string>();
  const sourcePaths = new Set<string>();

  for (const scenario of catalog) {
    validateMetadata(scenario.metadata);
    assertNonEmpty(scenario.source.id, "source.id", scenario.metadata.id);
    assertNonEmpty(
      scenario.source.marker,
      "source.marker",
      scenario.metadata.id,
    );
    assertNonEmpty(scenario.source.path, "source.path", scenario.metadata.id);
    if (scenario.source.language !== "tsx") {
      throw new Error(
        `Scenario "${scenario.metadata.id}" must use TSX source metadata.`,
      );
    }
    if (!scenario.source.path.endsWith(".example.tsx")) {
      throw new Error(
        `Scenario "${scenario.metadata.id}" must reference a TSX example source.`,
      );
    }
    if (
      !Number.isInteger(scenario.canvas.width) ||
      scenario.canvas.width <= 0 ||
      !Number.isInteger(scenario.canvas.height) ||
      scenario.canvas.height <= 0
    ) {
      throw new Error(
        `Scenario "${scenario.metadata.id}" must use positive integral canvas dimensions.`,
      );
    }

    const actionIds = new Set<string>();
    for (const action of scenario.actions) {
      assertNonEmpty(action.id, "action.id", scenario.metadata.id);
      assertNonEmpty(action.label, "action.label", scenario.metadata.id);
      if (!ID_PATTERN.test(action.id) || actionIds.has(action.id)) {
        throw new Error(
          `Scenario "${scenario.metadata.id}" has an invalid or duplicate action id.`,
        );
      }
      actionIds.add(action.id);
    }

    if (ids.has(scenario.metadata.id)) {
      throw new Error(`Duplicate scenario id "${scenario.metadata.id}".`);
    }
    if (slugs.has(scenario.metadata.slug)) {
      throw new Error(`Duplicate scenario slug "${scenario.metadata.slug}".`);
    }
    if (learningOrders.has(scenario.metadata.learningOrder)) {
      throw new Error(
        `Duplicate scenario learning order "${scenario.metadata.learningOrder}".`,
      );
    }
    if (sourceIds.has(scenario.source.id)) {
      throw new Error(`Duplicate scenario source id "${scenario.source.id}".`);
    }
    if (sourcePaths.has(scenario.source.path)) {
      throw new Error(
        `Duplicate scenario source path "${scenario.source.path}".`,
      );
    }
    ids.add(scenario.metadata.id);
    learningOrders.add(scenario.metadata.learningOrder);
    slugs.add(scenario.metadata.slug);
    sourceIds.add(scenario.source.id);
    sourcePaths.add(scenario.source.path);
  }

  return catalog;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function groupCatalog(
  catalog: readonly AnyScenarioCatalogEntry[],
  keysFor: (entry: AnyScenarioCatalogEntry) => readonly string[],
): readonly ScenarioCatalogGroup[] {
  const grouped = new Map<string, AnyScenarioCatalogEntry[]>();
  for (const entry of catalog) {
    for (const key of keysFor(entry)) {
      const entries = grouped.get(key) ?? [];
      entries.push(entry);
      grouped.set(key, entries);
    }
  }
  return [...grouped]
    .sort(([left], [right]) => compareText(left, right))
    .map(([key, entries]) => ({
      key,
      label: key,
      scenarios: entries.sort(
        (left, right) =>
          left.metadata.learningOrder - right.metadata.learningOrder,
      ),
    }));
}

export function createScenarioCatalogIndex(
  catalog: readonly AnyScenarioCatalogEntry[],
): ScenarioCatalogIndex {
  const learningPath = [...catalog].sort(
    (left, right) => left.metadata.learningOrder - right.metadata.learningOrder,
  );
  return {
    learningPath,
    byApi: groupCatalog(learningPath, (entry) => entry.metadata.apiTags),
    byConcept: groupCatalog(
      learningPath,
      (entry) => entry.metadata.conceptTags,
    ),
    byCategory: groupCatalog(learningPath, (entry) => [
      entry.metadata.category,
    ]),
    byVisibilityAndMaturity: groupCatalog(learningPath, (entry) => [
      `${entry.metadata.visibility} / ${entry.metadata.maturity}`,
    ]),
  };
}

export function getScenarioRoute(entry: ScenarioCatalogRecord): string {
  return `#/testing/${entry.metadata.slug}`;
}

export async function loadScenario<TState>(
  entry: ScenarioCatalogEntry<TState>,
): Promise<ScenarioDefinition<TState>> {
  const definition = await entry.load();
  const actionIds = entry.actions.map((action) => action.id);
  if (definition.id !== entry.metadata.id) {
    throw new Error(
      `Loaded scenario id "${definition.id}" does not match catalog id "${entry.metadata.id}".`,
    );
  }
  if (definition.sourceId !== entry.source.id) {
    throw new Error(
      `Loaded scenario "${definition.id}" does not match source "${entry.source.id}".`,
    );
  }
  if (!sameValues(definition.actionIds, actionIds)) {
    throw new Error(
      `Loaded scenario "${definition.id}" actions do not match its catalog entry.`,
    );
  }
  return definition;
}

const smokeMetadata: ScenarioMetadata = {
  id: "baseline-smoke",
  slug: "baseline-smoke",
  title: "Baseline smoke",
  summary: "Mount, render, update, click, and reset one public-API CRC scene.",
  category: "Getting started",
  apiTags: ["crc", "Rectangle", "Text"],
  conceptTags: ["mount", "render", "state update", "mouse click"],
  manualSteps: [
    {
      action: "Open the scenario or choose Reset.",
      expected:
        "A blue rectangle reports revision 0, clicks 0, and reset/mount as the last action.",
    },
    {
      action: "Choose Update scene.",
      expected: "The rectangle turns purple and the revision increases by one.",
    },
    {
      action: "Click inside the colored rectangle.",
      expected:
        "The rectangle turns orange and the click count increases by one.",
    },
    {
      action: "Choose Reset.",
      expected: "The blue initial scene returns with revision 0 and clicks 0.",
    },
  ],
  knownLimitations: [
    "This baseline covers Chromium mouse input only; broader browser and input-device coverage is not part of the current trust gate.",
    "The Canvas click target has no keyboard equivalent in the current public API.",
  ],
  learningOrder: 10,
  visibility: "documentation-candidate",
  visibilityReason:
    "It is a minimal, readable public-API introduction without test-only diagnostics.",
  maturity: "baseline",
};

export const smokeScenarioEntry: ScenarioCatalogEntry<SmokeScenarioState> = {
  metadata: smokeMetadata,
  canvas: {
    width: 480,
    height: 240,
  },
  actions: [{ id: "update", label: "Update scene" }],
  source: {
    id: "baseline-smoke-example",
    language: "tsx",
    marker: "SMOKE_SOURCE_ID = 'baseline-smoke-example'",
    path: "packages/scenarios/src/smoke.example.tsx",
  },
  load: async () => (await import("./smoke")).smokeScenario,
};

const drawingShapesMetadata: ScenarioMetadata = {
  id: "drawing-shapes",
  slug: "drawing-shapes",
  title: "Draw shapes",
  summary:
    "Build rounded and conventional shapes, custom paths, and creator-based clipping, then update their geometry and styles.",
  category: "Drawing basics",
  apiTags: [
    "Rectangle",
    "Path",
    "SvgPath",
    "Circle",
    "Ellipse",
    "Arc",
    "Wedge",
    "Polygon",
    "RegularPolygon",
    "Star",
    "Clip",
    "createRegularPolygonPath",
  ],
  conceptTags: [
    "fill and stroke",
    "custom geometry",
    "curved geometry",
    "rounded corners",
    "generated geometry",
    "clipping",
    "pixel alignment",
    "updates",
  ],
  manualSteps: [
    {
      action:
        "Compare the rounded rectangle, triangle, diamond, regular polygon, and compact curved-shape row.",
      expected:
        "Each primitive shows deliberate fill or stroke geometry on a neutral background.",
    },
    {
      action: "Choose Update shapes.",
      expected:
        "The rectangle, paths, circle, ellipse, arc, wedge, polygon, regular polygon, star, and clipped fill update together.",
    },
    {
      action:
        "Click the star, the rounded rectangle’s red corner cut, and inside and outside the hexagonal clip, then choose Reset.",
      expected:
        "Only retained star and clipped geometry receives its hit; the corner cut and outside-hex click reach their underlays, and Reset clears the counters.",
    },
  ],
  knownLimitations: [
    "Path2D geometry follows the browser Canvas implementation; malformed SVG path diagnostics are verified by the focused component suite rather than taught here.",
    "Canvas content has no retained DOM nodes or automatic keyboard semantics.",
  ],
  learningOrder: 20,
  visibility: "documentation-candidate",
  visibilityReason:
    "It is a concise public-API introduction to every supported shape export.",
  maturity: "contract",
};

export const drawingShapesScenarioEntry: ScenarioCatalogEntry<DrawingShapesState> =
  {
    metadata: drawingShapesMetadata,
    canvas: { width: 480, height: 240 },
    actions: [{ id: "update-shapes", label: "Update shapes" }],
    source: {
      id: "drawing-shapes-example",
      language: "tsx",
      marker: "DRAWING_SHAPES_SOURCE_ID = 'drawing-shapes-example'",
      path: "packages/scenarios/src/drawing-shapes.example.tsx",
    },
    load: async () => (await import("./drawing-gallery")).drawingShapesScenario,
  };

const drawingLinesMetadata: ScenarioMetadata = {
  id: "drawing-lines",
  slug: "drawing-lines",
  title: "Draw lines",
  summary:
    "Draw a multi-point line plus crisp horizontal and vertical rules with the public line helpers.",
  category: "Drawing basics",
  apiTags: ["Line", "HorizontalLine", "VerticalLine"],
  conceptTags: ["polyline", "stroke width", "pixel alignment", "updates"],
  manualSteps: [
    {
      action: "Inspect the blue polyline and the thin orange and green rules.",
      expected:
        "The polyline joins every coordinate while rounded pixel alignment keeps the one-pixel rules crisp.",
    },
    {
      action: "Choose Update lines.",
      expected:
        "The polyline points, color, and width change; both rules move without leaving stale pixels.",
    },
    {
      action: "Choose Reset.",
      expected:
        "The initial coordinates and colors return; the empty line remains a safe no-op.",
    },
  ],
  knownLimitations: [
    "This readable lesson uses rounded alignment; the focused component matrix covers none, round, ceil, and floor plus default full-canvas bounds.",
    "Line interaction widths are taught in the geometry and interaction laboratories.",
  ],
  learningOrder: 30,
  visibility: "documentation-candidate",
  visibilityReason:
    "It demonstrates every supported Line-family export with short, readable public calls.",
  maturity: "contract",
};

export const drawingLinesScenarioEntry: ScenarioCatalogEntry<DrawingLinesState> =
  {
    metadata: drawingLinesMetadata,
    canvas: { width: 480, height: 240 },
    actions: [{ id: "update-lines", label: "Update lines" }],
    source: {
      id: "drawing-lines-example",
      language: "tsx",
      marker: "DRAWING_LINES_SOURCE_ID = 'drawing-lines-example'",
      path: "packages/scenarios/src/drawing-lines.example.tsx",
    },
    load: async () => (await import("./drawing-gallery")).drawingLinesScenario,
  };

const drawingTextMetadata: ScenarioMetadata = {
  id: "drawing-text",
  slug: "drawing-text",
  title: "Draw text",
  summary:
    "Render aligned text and compare visible, ellipsis, squish, wrapping, clipping, and alpha behavior.",
  category: "Drawing basics",
  apiTags: ["Text"],
  conceptTags: [
    "typography",
    "overflow",
    "word wrap",
    "alignment",
    "interaction bounds",
  ],
  manualSteps: [
    {
      action:
        "Compare the heading, centered label, ellipsis, squish, wrapped, and clipped examples.",
      expected:
        "Each card demonstrates one visible text layout contract without overlapping adjacent cards.",
    },
    {
      action: "Click centered, then choose Update copy.",
      expected:
        "The centered/middle-aligned label records the click; updated heading and bounded copy replace the original pixels.",
    },
    {
      action: "Inspect the red lower card, then choose Reset.",
      expected:
        "Alpha-zero text leaves the card solid red, and Reset restores the original copy and click count.",
    },
  ],
  knownLimitations: [
    "Exact glyph rasterization is browser/font-platform dependent; semantic state, measured interaction bounds, card containment, and stable interior pixels are deterministic.",
    "The current public API exposes Canvas text layout rather than DOM accessibility or rich-text semantics.",
  ],
  learningOrder: 40,
  visibility: "documentation-candidate",
  visibilityReason:
    "It teaches supported text layout modes with readable bounded examples.",
  maturity: "contract",
};

export const drawingTextScenarioEntry: ScenarioCatalogEntry<DrawingTextState> =
  {
    metadata: drawingTextMetadata,
    canvas: { width: 480, height: 240 },
    actions: [{ id: "update-copy", label: "Update copy" }],
    source: {
      id: "drawing-text-example",
      language: "tsx",
      marker: "DRAWING_TEXT_SOURCE_ID = 'drawing-text-example'",
      path: "packages/scenarios/src/drawing-text.example.tsx",
    },
    load: async () => (await import("./drawing-gallery")).drawingTextScenario,
  };

const drawingImagesMetadata: ScenarioMetadata = {
  id: "drawing-images",
  slug: "drawing-images",
  title: "Draw images",
  summary:
    "Load deterministic data images with explicit or natural dimensions, alpha, borders, source changes, failure, and removal.",
  category: "Drawing basics",
  apiTags: ["Image"],
  conceptTags: [
    "image loading",
    "natural size",
    "explicit size",
    "alpha",
    "source lifecycle",
  ],
  manualSteps: [
    {
      action:
        "Compare the featured image, natural-size image, alpha-zero red card, and half-alpha bordered strip.",
      expected:
        "The blue featured image uses explicit dimensions, the pink image uses its natural 90×60 size, alpha zero reveals solid red, and the lower image blends with its underlay.",
    },
    {
      action: "Choose Change image, Natural size, and Explicit size.",
      expected:
        "The current source changes from blue to pink; the featured image switches between intrinsic 90×60 and explicit 150×100 bounds.",
    },
    {
      action: "Choose Broken image, Remove image, Show image, then Reset.",
      expected:
        "Broken and removed sources reveal the gray placeholder, Show image restores blue, and Reset restores the initial explicit-size state.",
    },
  ],
  knownLimitations: [
    "The public image component has no load/error callback; visible source state is expressed through pixels and scenario state.",
    "Controlled out-of-order load completion and detached late callbacks share the TFC-07 lifecycle driver rather than adding test controls to this teaching example.",
  ],
  learningOrder: 50,
  visibility: "documentation-candidate",
  visibilityReason:
    "It uses self-contained sources and readable public calls for every supported image sizing and lifecycle mode.",
  maturity: "contract",
};

export const drawingImagesScenarioEntry: ScenarioCatalogEntry<DrawingImagesState> =
  {
    metadata: drawingImagesMetadata,
    canvas: { width: 480, height: 240 },
    actions: [
      { id: "change-image", label: "Change image" },
      { id: "use-natural-size", label: "Natural size" },
      { id: "use-explicit-size", label: "Explicit size" },
      { id: "show-broken-image", label: "Broken image" },
      { id: "remove-image", label: "Remove image" },
      { id: "show-image", label: "Show image" },
    ],
    source: {
      id: "drawing-images-example",
      language: "tsx",
      marker: "DRAWING_IMAGES_SOURCE_ID = 'drawing-images-example'",
      path: "packages/scenarios/src/drawing-images.example.tsx",
    },
    load: async () => (await import("./drawing-gallery")).drawingImagesScenario,
  };

const drawingCompositionMetadata: ScenarioMetadata = {
  id: "drawing-composition",
  slug: "drawing-composition",
  title: "Compose a scene",
  summary:
    "Compose transformed groups, clipped children, an even-odd hole, and cached offscreen artwork.",
  category: "Drawing composition",
  apiTags: ["Group", "Clip", "Layer"],
  conceptTags: [
    "transforms",
    "clipping",
    "even-odd fill",
    "offscreen layer",
    "updates",
  ],
  manualSteps: [
    {
      action:
        "Compare the left group, center clipping region and hole, and right layered artwork.",
      expected:
        "The group positions related shapes together, clips hide pixels beyond their paths, the even-odd center remains a hole, and the layer draws one offscreen card.",
    },
    {
      action: "Choose Update composition.",
      expected:
        "The group moves and rotates, the main clip becomes rounded, and the layer changes from a blue rectangle to a pink triangle.",
    },
    {
      action: "Choose Reset.",
      expected:
        "All composed geometry returns to its initial positions, clip, and layer artwork.",
    },
  ],
  knownLimitations: [
    "Nested clips, transformed layer bounds, paint ordering, and interaction composition have deliberately shared exhaustive coverage in the TFC-05 geometry matrix.",
    "Layers cache drawing work in an OffscreenCanvas; they are a rendering boundary, not a DOM stacking context.",
  ],
  learningOrder: 60,
  visibility: "documentation-candidate",
  visibilityReason:
    "It teaches the three composition exports after the basic drawing lessons using a compact visual scene.",
  maturity: "contract",
};

export const drawingCompositionScenarioEntry: ScenarioCatalogEntry<DrawingCompositionState> =
  {
    metadata: drawingCompositionMetadata,
    canvas: { width: 480, height: 240 },
    actions: [{ id: "update-composition", label: "Update composition" }],
    source: {
      id: "drawing-composition-example",
      language: "tsx",
      marker: "DRAWING_COMPOSITION_SOURCE_ID = 'drawing-composition-example'",
      path: "packages/scenarios/src/drawing-composition.example.tsx",
    },
    load: async () =>
      (await import("./drawing-gallery")).drawingCompositionScenario,
  };

const focusNavigationMetadata: ScenarioMetadata = {
  id: "focus-and-keyboard-navigation",
  slug: "focus-and-keyboard-navigation",
  title: "Focus and keyboard navigation",
  summary:
    "Cross one Canvas focus host, traverse explicit logical controls, and use contained directional navigation.",
  category: "Keyboard interaction",
  apiTags: [
    "useEventTarget",
    "FocusManagement",
    "KeyboardNavigation",
    "keyboard events",
    "pointer events",
  ],
  conceptTags: [
    "logical focus",
    "source-order Tab",
    "directional navigation",
    "keyboard activation",
    "focus-visible",
  ],
  manualSteps: [
    {
      action:
        "Focus the native control before the Canvas and press Tab through the scene.",
      expected:
        "One order crosses two top controls, squares 1–12 row by row, two bottom controls, and the native control after the Canvas.",
    },
    {
      action: "Enter the Canvas in reverse with Shift+Tab.",
      expected:
        "Focus starts on the last Canvas control and traverses every logical target in reverse before returning to native DOM.",
    },
    {
      action:
        "Use arrow keys in the square collection and on the form-like top control.",
      expected:
        "Squares move only to the nearest in-boundary neighbor without wrapping; the form-like control keeps its own horizontal arrows.",
    },
    {
      action:
        "Activate controls with a pointer, Enter, and Space, then press an empty Canvas area.",
      expected:
        "The state panel reports activation source and count; empty background keeps DOM focus on the Canvas while clearing logical focus.",
    },
    {
      action:
        "Choose Reorder squares, Remove current square, and Restore squares.",
      expected:
        "A keyed surviving target keeps focus through reorder, removing it clears focus, and restoration returns the row-major declaration.",
    },
  ],
  knownLimitations: [
    "CRC logical Canvas focus is keyboard interaction, not screen-reader semantics; applications must provide and synchronize an equivalent semantic DOM experience.",
    "Directional navigation does not wrap or escape from the nearest boundary, and positive numeric tabindex ordering is not supported.",
  ],
  learningOrder: 65,
  visibility: "documentation-candidate",
  visibilityReason:
    "It is one readable public-API example shared by manual and headless keyboard verification.",
  maturity: "contract",
};

export const focusNavigationScenarioEntry: ScenarioCatalogEntry<FocusNavigationState> =
  {
    metadata: focusNavigationMetadata,
    canvas: { width: 560, height: 420 },
    actions: [
      { id: "reorder-squares", label: "Reorder squares" },
      { id: "remove-current-square", label: "Remove current square" },
      { id: "restore-squares", label: "Restore squares" },
    ],
    source: {
      id: FOCUS_NAVIGATION_SOURCE_ID,
      language: "tsx",
      marker: "'focus-and-keyboard-navigation-example'",
      path: "packages/scenarios/src/focus-navigation.example.tsx",
    },
    load: async () =>
      (await import("./focus-navigation")).focusNavigationScenario,
  };

const interactionLabMetadata: ScenarioMetadata = {
  id: "interaction-trace-lab",
  slug: "interaction-trace-lab",
  title: "User-event contract laboratory",
  summary:
    "Drive propagation, capture, touch retention, cancellation, keyboard, composition, clipboard, drag/drop, and legacy mouse rules through shared public-API fixtures.",
  category: "Interaction contracts",
  apiTags: [
    "crc",
    "useEvent",
    "useEventListener",
    "useEventTarget",
    "Path",
    "Line",
    "Rectangle",
    "mouse events",
    "pointer events",
    "touch events",
    "wheel events",
    "keyboard events",
    "composition events",
    "clipboard events",
    "drag events",
  ],
  conceptTags: [
    "event order",
    "propagation",
    "pointer capture",
    "target retention",
    "cancellation",
    "related targets",
    "topmost target",
    "cursor parity",
    "activation identity",
  ],
  manualSteps: [
    {
      action:
        "Open Propagation and press the blue target, then open Pointer capture and drag from the custom teal path beyond its bounds.",
      expected:
        "Propagation reports parent capture, target capture/target, then parent bubble with phases 1, 2, 2, 3; pointer movement remains with the custom target until release.",
    },
    {
      action:
        "Open Touch retention and drag one contact outside the purple target, then use a trackpad or wheel over Wheel cancellation.",
      expected:
        "Touch move/end retain the start target and identifier; wheel reports deltas and default cancellation.",
    },
    {
      action:
        "Inspect the Keyboard fields, Composition, and Clipboard headless contract fixtures; their automated cases use internal headless contract transport.",
      expected:
        "The internal tests preserve key/code/repeat/composition state, composition data, and clipboard payload without claiming a public adapter or CRC creating hidden editable DOM.",
    },
    {
      action:
        "Open Drag/drop and move one drag payload from the blue region to the purple region before dropping.",
      expected:
        "The trace reports leave before enter, logical related targets, then dragover and drop on the purple region.",
    },
    {
      action:
        "In Regions, move from background into Left, within Left, directly to Right, to Canvas background, outside the Canvas, and back to Left.",
      expected:
        "Every route reports exit before entry and entry before movement; root exit reports one logical mouseout.",
    },
    {
      action:
        "Open Overlap, move through lower-only and overlap points, choose Reorder overlap, move again, then Remove top and move again.",
      expected:
        "Only the later-painted live region records input, and its crosshair/pointer cursor agrees with the trace after every change.",
    },
    {
      action:
        "Open Nested and each fill, stroke, fill + stroke, transparent, interaction-width, and no-hit fixture; move through the visible positive and negative areas.",
      expected:
        "Untransformed nested/topmost rules and configured interaction geometry match the visible fixture; every successful entry precedes movement.",
    },
    {
      action:
        "Back in Regions, replace/remove the Left handler and exercise same-target click, cross-target press/release, leave/re-entry click, double click, and context menu.",
      expected:
        "Only the current generation runs, removed targets stay silent, same-live-target activation succeeds, and browser context order is preserved.",
    },
    {
      action:
        "Open Observer, Observer replace/remove, and Observer throwing; move twice through each target, then run Remove target after transition from Left to Right and choose Reset.",
      expected:
        "Canvas observers follow target callbacks; queued replacement/removal appears on the next event; a thrown observer does not stop its safe peer; only Right disappears after the current route; Reset restores Regions.",
    },
  ],
  knownLimitations: [
    "A plain Canvas has no logical keyboard, editing, or clipboard target; no public input adapter exists, and CRC does not create hidden editable DOM.",
    "This ordering laboratory intentionally uses an untransformed root Canvas; the shared geometry matrix covers CSS scale, transforms, clips, and offscreen layers.",
    "A CRC rerender requested from a handler settles on the next animation frame; narrow dispatcher tests separately prove synchronous live-registry mutation semantics.",
    "New logical event facades expose opaque related targets; the retained legacy mouse fixtures still present readable target labels rather than public target identities.",
    "The Observer throwing fixture deliberately reports one browser error; context-menu ordering follows the active browser instead of being normalized.",
  ],
  learningOrder: 80,
  visibility: "test-laboratory",
  visibilityReason:
    "It exposes a dense conformance matrix and deliberate error path rather than a beginner-facing API lesson.",
  maturity: "trusted",
};

export const interactionLabScenarioEntry: ScenarioCatalogEntry<InteractionLabState> =
  {
    metadata: interactionLabMetadata,
    canvas: {
      width: 480,
      height: 240,
    },
    actions: [
      { id: "show-propagation", label: "Propagation" },
      { id: "show-pointer-capture", label: "Pointer capture" },
      { id: "show-touch-retention", label: "Touch retention" },
      { id: "show-wheel-cancellation", label: "Wheel cancellation" },
      { id: "show-keyboard-fields", label: "Keyboard fields" },
      { id: "show-composition", label: "Composition" },
      { id: "show-clipboard", label: "Clipboard" },
      { id: "show-drag-drop", label: "Drag/drop" },
      { id: "show-regions", label: "Regions" },
      { id: "show-overlap", label: "Overlap" },
      { id: "show-nested", label: "Nested" },
      { id: "show-fill", label: "Fill" },
      { id: "show-stroke", label: "Stroke" },
      { id: "show-fill-stroke", label: "Fill + stroke" },
      { id: "show-transparent", label: "Transparent fill" },
      { id: "show-interaction-width", label: "Interaction width" },
      { id: "show-no-hit", label: "No hit geometry" },
      { id: "show-observer", label: "Canvas observer" },
      { id: "show-observer-remove", label: "Observer queues removal" },
      { id: "show-observer-replace", label: "Observer queues replacement" },
      { id: "show-observer-throwing", label: "Throwing observer" },
      {
        id: "show-remove-target-after-transition",
        label: "Remove target after transition",
      },
      { id: "reorder-overlap", label: "Reorder overlap" },
      { id: "remove-top", label: "Remove top" },
      { id: "replace-handler", label: "Replace handler" },
      { id: "remove-handler", label: "Remove handler" },
      { id: "clear-trace", label: "Clear trace" },
    ],
    source: {
      id: "interaction-trace-lab-example",
      language: "tsx",
      marker: "INTERACTION_LAB_SOURCE_ID = 'interaction-trace-lab-example'",
      path: "packages/scenarios/src/interaction-lab.example.tsx",
    },
    load: async () =>
      (await import("./interaction-lab")).interactionLabScenario,
  };

const mouseContractMetadata: ScenarioMetadata = {
  id: "mouse-interaction-contract",
  slug: "mouse-interaction-contract",
  title: "Mouse interaction contract",
  summary:
    "Explore the approved native evidence and the target/order rules implemented by CRC’s dispatcher.",
  category: "Interaction contracts",
  apiTags: ["crc", "mouse events", "Rectangle", "Layer", "Clip", "Group"],
  conceptTags: [
    "event order",
    "topmost target",
    "click identity",
    "coordinates",
  ],
  manualSteps: [
    {
      action: "Select Enter, Move within, Switch, and Exit cases.",
      expected:
        "The approved CRC sequence reports boundary transitions before movement.",
    },
    {
      action: "Select overlap, nested child, clip, transform, and layer cases.",
      expected:
        "The highlighted target and rule consistently use topmost reverse paint order and clip intersection.",
    },
    {
      action:
        "Select primary, cross-target, double-click, and context-menu cases.",
      expected:
        "The trace table distinguishes successful activation, no region click, and browser-dependent context ordering.",
    },
    {
      action: "Choose Reset.",
      expected: "The explorer returns to Enter a region.",
    },
  ],
  knownLimitations: [
    "The explorer summarizes the approved contract; the ordering and geometry laboratories provide exhaustive runtime conformance evidence.",
    "This historical explorer retains its mouse-only oracle; the shared user-event laboratory covers pointer, touch, propagation, cancellation, and capture.",
    "Context-menu event order is shown for the reference Chromium environment and is not normalized across browsers.",
  ],
  learningOrder: 70,
  visibility: "test-laboratory",
  visibilityReason:
    "It is a design oracle and implementation guide rather than a beginner API example.",
  maturity: "contract",
};

export const mouseContractScenarioEntry: ScenarioCatalogEntry<MouseContractScenarioState> =
  {
    metadata: mouseContractMetadata,
    canvas: { width: 480, height: 240 },
    actions: MOUSE_CONTRACT_CASES.map((contractCase) => ({
      id: `show-${contractCase.id}`,
      label: contractCase.title,
    })),
    source: {
      id: "mouse-interaction-contract-example",
      language: "tsx",
      marker: "MOUSE_CONTRACT_SOURCE_ID = 'mouse-interaction-contract-example'",
      path: "packages/scenarios/src/mouse-contract.example.tsx",
    },
    load: async () =>
      (await import("./mouse-contract-scenario")).mouseContractScenario,
  };



const agentLateFontEntry: ScenarioCatalogEntry<import('./agent-late-font').AgentLateFontState> = {
  metadata: {
    id: 'agent-late-font', slug: 'agent-late-font', title: 'Late font readiness diagnosis',
    summary: 'Distinguish loaded fonts from scheduled repaint and responsive text updates.', category: 'Diagnostics',
    apiTags: ['Text', 'signal', 'useLayoutBox'], conceptTags: ['fonts', 'readiness', 'verification'],
    manualSteps: [
      { action: 'Choose Load font.', expected: 'Font readiness and measured width change; existing Canvas pixels wait for repaint.' },
      { action: 'Choose Repaint.', expected: 'An application signal requests rendering with the ready font.' },
      { action: 'Choose Narrow canvas.', expected: 'The responsive allocation becomes 200 pixels wide and text size becomes 16px.' },
    ],
    knownLimitations: ['No-redraw observations cover two host frames only. Measurements do not prove individual glyph font attribution.', 'Source scheduler inspection only; no served-build attestation.'],
    learningOrder: 79, visibility: 'test-laboratory', visibilityReason: 'Controlled local font readiness and application repaint evidence.', maturity: 'characterization',
  },
  canvas: { width: 400, height: 120 },
  actions: [{ id: 'load-font', label: 'Load font' }, { id: 'repaint', label: 'Repaint' }, { id: 'narrow', label: 'Narrow canvas' }, { id: 'wide', label: 'Wide canvas' }, { id: 'reset', label: 'Reset' }],
  source: { id: 'agent-late-font-example', language: 'tsx', marker: "AGENT_LATE_FONT_SOURCE_ID = 'agent-late-font-example'", path: 'packages/scenarios/src/agent-late-font.example.tsx' },
  load: async () => (await import('./agent-late-font')).agentLateFontScenario,
};

const agentLayoutPlacementEntry: ScenarioCatalogEntry<import('./agent-layout-placement').AgentLayoutPlacementState> = {
  metadata: {
    id: 'agent-layout-placement', slug: 'agent-layout-placement', title: 'Layout placement diagnosis',
    summary: 'Separate parent placement from local shape offsets and diagnose a clipped shape.', category: 'Diagnostics',
    apiTags: ['Absolute', 'Group', 'Rectangle', 'useLayoutBox'], conceptTags: ['layout', 'clipping', 'verification'],
    manualSteps: [
      { action: 'Inspect the clipped mode.', expected: 'Allocation exists but the local offset puts the shape outside the parent clip.' },
      { action: 'Choose Allow overflow and click the blue shape.', expected: 'The same offset is visible and targetable under the explicit policy.' },
      { action: 'Choose Repair local offset and click the blue shape.', expected: 'The shape moves inside the clip; allocation stays unchanged.' },
    ],
    knownLimitations: ['Controlled input provenance, not a general style inspector. Source inspection only; no served-build attestation yet.', 'Point probes establish targeting geometry, not painted visibility.'],
    learningOrder: 78, visibility: 'test-laboratory', visibilityReason: 'Controlled placement failure and repair for agent diagnosis.', maturity: 'characterization',
  },
  canvas: { width: 400, height: 240 },
  actions: [{ id: 'clipped', label: 'Seed clipped offset' }, { id: 'overflow-visible', label: 'Allow overflow' }, { id: 'repaired', label: 'Repair local offset' }, { id: 'overlap-allowed', label: 'Allow overlap' }, { id: 'overlap-prohibited', label: 'Require separation' }],
  source: { id: 'agent-layout-placement-example', language: 'tsx', marker: "AGENT_LAYOUT_PLACEMENT_SOURCE_ID = 'agent-layout-placement-example'", path: 'packages/scenarios/src/agent-layout-placement.example.tsx' },
  load: async () => (await import('./agent-layout-placement')).agentLayoutPlacementScenario,
};

const agentSignalMutationEntry: ScenarioCatalogEntry<import('./agent-signal-mutation').AgentSignalMutationState> = {
  metadata: {
    id: 'agent-signal-mutation', slug: 'agent-signal-mutation', title: 'Signal mutation diagnosis',
    summary: 'Distinguish reference-equal writes from a stale amount after in-place mutation, then repair by replacing the object.', category: 'Diagnostics',
    apiTags: ['signal', 'Rectangle', 'Text'], conceptTags: ['signals', 'equality', 'mutation', 'verification'],
    manualSteps: [
      { action: 'Choose Equal no-op.', expected: 'Amount stays 10; equal reference is intentional and the assertion passes.' },
      { action: 'Choose Mutate in place.', expected: 'Source amount becomes 42 while the painted bar and label remain at 10; the assertion fails.' },
      { action: 'Choose Replace object.', expected: 'The bar and label update to 42; signal revision advances and the assertion passes.' },
    ],
    knownLimitations: ['This explicit application sequence diagnoses the default Object.is policy; it is not a universal deep-mutation detector.', 'No-redraw evidence is bounded to two observed host frames. Signal revision inspection requires the source runtime.'],
    learningOrder: 77, visibility: 'test-laboratory', visibilityReason: 'Controlled application equality failure with independent intended value.', maturity: 'contract',
  },
  canvas: { width: 480, height: 180 },
  actions: [{ id: 'equal-noop', label: 'Equal no-op' }, { id: 'in-place', label: 'Mutate in place' }, { id: 'replace', label: 'Replace object' }, { id: 'reset', label: 'Reset' }],
  source: { id: 'agent-signal-mutation-example', language: 'tsx', marker: "AGENT_SIGNAL_MUTATION_SOURCE_ID = 'agent-signal-mutation-example'", path: 'packages/scenarios/src/agent-signal-mutation.example.tsx' },
  load: async () => (await import('./agent-signal-mutation')).agentSignalMutationScenario,
};

const agentTextScenarioEntry: ScenarioCatalogEntry<import('./agent-text-verification').AgentTextState> = {
  metadata: {
    id: 'agent-text-verification', slug: 'agent-text-verification', title: 'Agent text verification',
    summary: 'Verify an exact fixture label while redacting private text from machine evidence.', category: 'Diagnostics',
    apiTags: ['crc', 'Text'], conceptTags: ['text', 'redaction', 'inspection'],
    manualSteps: [{ action: 'Inspect the seeded label, then choose Repair.', expected: 'The assertion changes from fail to pass; the second string stays redacted in evidence.' }],
    knownLimitations: ['Source development only; successful calls are not proof of glyph visibility, font selection or clipping.'],
    learningOrder: 76, visibility: 'test-laboratory', visibilityReason: 'Controlled private and fixture text for agent assertions.', maturity: 'contract',
  },
  canvas: { width: 480, height: 160 }, actions: [{ id: 'seed', label: 'Seed wrong label' }, { id: 'repair', label: 'Repair label' }],
  source: { id: 'agent-text-verification-example', language: 'tsx', marker: "AGENT_TEXT_SOURCE_ID = 'agent-text-verification-example'", path: 'packages/scenarios/src/agent-text-verification.example.tsx' },
  load: async () => (await import('./agent-text-verification')).agentTextScenario,
};

const agentTargetingVerificationMetadata: ScenarioMetadata = {
  id: "agent-targeting-verification",
  slug: "agent-targeting-verification",
  title: "Agent targeting verification",
  summary:
    "Diagnose a decorative Canvas overlay that intercepts an intended item selection, then verify its repair with the same native click.",
  category: "Diagnostics",
  apiTags: ["crc", "Rectangle", "signal", "pointerEvents"],
  conceptTags: ["targeting", "paint order", "native input", "inspection"],
  manualSteps: [
    {
      action: "Choose Inspect, then click the center of the blue Select item A control.",
      expected:
        "The probe identifies the upper decoration and the click is delivered there, leaving item A unselected.",
    },
    {
      action: "Choose Repair, Inspect, then click the same point.",
      expected:
        "The decoration keeps painting but stops participating in targeting; the same click selects item A.",
    },
    {
      action: "Choose Intentional block and repeat the click.",
      expected:
        "The decoration receives the click again, while the scenario labels this as an intentional non-selection rather than a defect.",
    },
  ],
  knownLimitations: [
    "Clip attribution identifies committed interaction records, not source component identities.",
    "The bounded inspector reports this committed root and target point only; it does not expose a general component tree, application objects, or visibility proof.",
    "The fixture uses opaque rectangle geometry. Arbitrary custom drawing, blending, filters, and backend-specific picking require separate evidence.",
  ],
  learningOrder: 75,
  visibility: "test-laboratory",
  visibilityReason:
    "It is a deterministic, agent-oriented diagnostic fixture with an independently stated application outcome and one real browser input path.",
  maturity: "contract",
};

export const agentTargetingVerificationScenarioEntry: ScenarioCatalogEntry<AgentTargetingState> = {
  metadata: agentTargetingVerificationMetadata,
  canvas: { width: 480, height: 240 },
  actions: [
    { id: "keyboard-focus", label: "Keyboard focus" },
    { id: "dom-overlay", label: "Add DOM overlay" },
    { id: "remove-dom-overlay", label: "Remove DOM overlay" },
    { id: "capture-drag", label: "Capture drag" },
    { id: "pagination-scene", label: "Show 100 extra targets" },
    { id: "scene-page-first", label: "Start scene query" },
    { id: "scene-page-next", label: "Next scene page" },
    { id: "inspect", label: "Inspect target" },
    { id: "inspect-outside-layer", label: "Inspect outside Layer" },
    { id: "repair", label: "Repair decoration" },
    { id: "seed", label: "Restore seeded failure" },
    { id: "intentional-block", label: "Show intentional block" },
    { id: "inspection-off", label: "Disable inspection" },
    { id: "inspection-on", label: "Enable inspection" },
    { id: "capture-sources", label: "Capture source locations" },
    { id: "trace-start", label: "Start phase recording" },
    { id: "trace-stop", label: "Stop phase recording" },
    { id: "reset", label: "Reset" },
  ],
  source: {
    id: "agent-targeting-verification-example",
    language: "tsx",
    marker:
      "AGENT_TARGETING_VERIFICATION_SOURCE_ID = 'agent-targeting-verification-example'",
    path: "packages/scenarios/src/agent-targeting-verification.example.tsx",
  },
  load: async () =>
    (await import("./agent-targeting-verification")).agentTargetingVerificationScenario,
};

const lifecycleLabMetadata: ScenarioMetadata = {
  id: "event-lifecycle-lab",
  slug: "event-lifecycle-lab",
  title: "Event lifecycle laboratory",
  summary:
    "Exercise rerender, handler, subtree, layer, abort, dispose, remount, and stale-cleanup ownership flows.",
  category: "Diagnostics",
  apiTags: ["crc", "CRCController", "Rectangle", "Layer", "mouse events"],
  conceptTags: ["event ownership", "teardown", "dispose", "remount"],
  manualSteps: [
    {
      action:
        "Choose Run 1,000 rerenders, then Replace handler and click the blue primary region.",
      expected:
        "Revision reaches 1,000; the visible handler generation changes and only the replacement records the click.",
    },
    {
      action:
        "Choose Remove handler and Remove subtree, then click their former regions.",
      expected:
        "The geometry/cursor state disappears or becomes inert and no ghost call is recorded.",
    },
    {
      action:
        "Choose Add layer, click the orange layer, then Remove layer and click its former location.",
      expected:
        "The layer records one call while mounted, then its pixels, cursor, and event behavior disappear.",
    },
    {
      action:
        "Choose Abort runtime or Dispose runtime, Cleanup again, Remount runtime, and Cleanup stale.",
      expected:
        "Cleanup is harmless when repeated; a stale signal/controller cannot disturb the fresh mount.",
    },
    {
      action: "Click Throws, then Safe, and finally choose Reset.",
      expected:
        "The deliberate error is reported, Safe still records input, and Reset restores the initial mounted scene.",
    },
  ],
  knownLimitations: [
    "Private listener, registry, teardown, instance, and frame ledgers remain test-only; the gallery exposes the same semantic lifecycle actions.",
    "The Throws region deliberately reports one browser error so error isolation can be inspected.",
    "Image races, hook cleanup, nested layers, and repeated whole-runtime disposal are covered by the separate cleanup stress laboratory.",
  ],
  learningOrder: 90,
  visibility: "test-laboratory",
  visibilityReason:
    "It exposes lifecycle stress controls and disposal semantics rather than a beginner-facing lesson.",
  maturity: "trusted",
};

export const lifecycleLabScenarioEntry: ScenarioCatalogEntry<LifecycleLabState> =
  {
    metadata: lifecycleLabMetadata,
    canvas: { width: 480, height: 240 },
    actions: [
      { id: "rerender-1000", label: "Run 1,000 rerenders" },
      { id: "replace-handler", label: "Replace handler" },
      { id: "remove-handler", label: "Remove handler" },
      { id: "remove-subtree", label: "Remove subtree" },
      { id: "add-layer", label: "Add layer" },
      { id: "remove-layer", label: "Remove layer" },
      { id: "abort-runtime", label: "Abort runtime" },
      { id: "dispose-runtime", label: "Dispose runtime" },
      { id: "cleanup-again", label: "Cleanup again" },
      { id: "remount-runtime", label: "Remount runtime" },
      { id: "cleanup-stale", label: "Cleanup stale runtime" },
    ],
    source: {
      id: "event-lifecycle-lab-example",
      language: "tsx",
      marker: "LIFECYCLE_LAB_SOURCE_ID = 'event-lifecycle-lab-example'",
      path: "packages/scenarios/src/lifecycle-lab.example.tsx",
    },
    load: async () => (await import("./lifecycle-lab")).lifecycleLabScenario,
  };

const geometryMatrixMetadata: ScenarioMetadata = {
  id: "geometry-composition-matrix",
  slug: "geometry-composition-matrix",
  title: "Geometry composition matrix",
  summary:
    "Probe intrinsic coordinates, nested transforms and clips, global layer paint order, layer bounds, and stroke interaction geometry.",
  category: "Interaction contracts",
  apiTags: [
    "crc",
    "Group",
    "Clip",
    "Layer",
    "Line",
    "Rectangle",
    "mouse events",
  ],
  conceptTags: [
    "coordinate conversion",
    "clip intersection",
    "paint order",
    "hit boundaries",
  ],
  manualSteps: [
    {
      action:
        "Compare Root fill boundaries with CSS-scaled fill boundaries at the visible center, left edge, and just outside.",
      expected:
        "Both cases target fill at the same intrinsic points and report the same intrinsic coordinates even though the scaled Canvas is half-size.",
    },
    {
      action:
        "Open Nested compound transform with clip; move through the blue quadrilateral, the clipped-away target at its upper-left, and clear background.",
      expected:
        "Only the visible transformed-and-clipped geometry targets transformed, and its pointer cursor agrees with the trace.",
    },
    {
      action:
        "Open Nested clip intersection and evenodd hole; probe the visible intersection, each single-clip-only area, and the central hole.",
      expected:
        "Only the visible intersection targets clipped; failing either active clip or entering the evenodd hole clears the target.",
    },
    {
      action:
        "Open Root and sibling layer paint order; sweep left to right through x=50, 120, 260, and 350 at y=120.",
      expected:
        "The single targets are root-under, layer-one, root-middle, and layer-two, with exit before entry and cursor parity at each switch.",
    },
    {
      action:
        "Open Transformed custom-size nested layer; probe the nested green area, its visually cropped continuation, the orange base, and the original unshifted location.",
      expected:
        "The translated nested layer wins only inside its visible bounds; cropped content falls through to the base and the unshifted location stays inert.",
    },
    {
      action:
        "Open Transformed stroke interaction boundary; probe the painted center, the upper interaction boundary, and one intrinsic pixel above it.",
      expected:
        "The center and boundary target stroke while the outside point misses; the wider interaction geometry never paints extra blue pixels.",
    },
  ],
  knownLimitations: [
    "The trusted matrix currently covers Chromium mouse input at device-pixel ratio 1; broader browser and pointer/touch coverage remain outside this plan.",
    "Rotation and skew values follow the existing degree-based DOMMatrix behavior of the public group API.",
    "Layers compose at their existing origin; group transforms supply the parent-space placement exercised here.",
  ],
  learningOrder: 100,
  visibility: "test-laboratory",
  visibilityReason:
    "It is a dense conformance and boundary matrix rather than a beginner-facing drawing example.",
  maturity: "trusted",
};

export const geometryMatrixScenarioEntry: ScenarioCatalogEntry<GeometryMatrixState> =
  {
    metadata: geometryMatrixMetadata,
    canvas: { width: 480, height: 240 },
    actions: [
      ...GEOMETRY_MATRIX_CASES.map((matrixCase) => ({
        id: `show-${matrixCase.id}`,
        label: matrixCase.title,
      })),
      { id: "clear-trace", label: "Clear trace" },
    ],
    source: {
      id: "geometry-composition-matrix-example",
      language: "tsx",
      marker:
        "GEOMETRY_MATRIX_SOURCE_ID = 'geometry-composition-matrix-example'",
      path: "packages/scenarios/src/geometry-matrix.example.tsx",
    },
    load: async () =>
      (await import("./geometry-matrix")).geometryMatrixScenario,
  };

const performanceLabMetadata: ScenarioMetadata = {
  id: "event-performance-lab",
  slug: "event-performance-lab",
  title: "Event performance laboratory",
  summary:
    "Measure hit-test structure and live dispatch latency across shared zero, sparse, dense, clipped, transformed, layered, cursor, and rerender workloads.",
  category: "Diagnostics",
  apiTags: ["crc", "Group", "Clip", "Layer", "Rectangle", "mouse events"],
  conceptTags: [
    "hit-test cost",
    "dispatch latency",
    "registration",
    "rerender stability",
  ],
  manualSteps: [
    {
      action:
        "Choose 0, 100, 1,000, and 10,000 sparse regions, then move over the green first region several times.",
      expected:
        "The first region remains the target while exact path/matrix/context counts scale linearly and live median, p95, and p99 latency samples update.",
    },
    {
      action:
        "Choose Dense overlap, Clipped, Transformed, Four layers, and Cursor, then move over each green probe area.",
      expected:
        "The visible green target wins, the cursor case shows a pointer, and each composition class reports its distinct exact structural work.",
    },
    {
      action:
        "Choose Run 25 unchanged rerenders on the 1,000- and 10,000-region scenes.",
      expected:
        "The revision advances by 25, the scene remains visually unchanged, and subsequent movement reports the same target and structural counts.",
    },
    {
      action: "Choose Reset.",
      expected:
        "The empty 0-region scene returns with cleared dispatch samples and counters.",
    },
  ],
  knownLimitations: [
    "Live timing is diagnostic and includes the laboratory counter overhead; deterministic headless guards use controlled warmup, repeated samples, and reference-environment budgets.",
    "The structural counter set is intentionally limited to Canvas context calls, save/restore, transforms, path/stroke tests, and DOMMatrix multiplication.",
    "These workloads characterize linear target resolution; spatial indexing remains deferred until a measured threshold requires it.",
  ],
  learningOrder: 110,
  visibility: "test-laboratory",
  visibilityReason:
    "It exposes stress loads and machine-sensitive timing diagnostics rather than beginner-facing API guidance.",
  maturity: "trusted",
};

export const performanceLabScenarioEntry: ScenarioCatalogEntry<PerformanceLabState> =
  {
    metadata: performanceLabMetadata,
    canvas: { width: 480, height: 240 },
    actions: [
      ...PERFORMANCE_WORKLOADS.map((workload) => ({
        id: `show-${workload.id}`,
        label: workload.title,
      })),
      { id: "rerender-25", label: "Run 25 unchanged rerenders" },
    ],
    source: {
      id: "event-performance-lab-example",
      language: "tsx",
      marker: "PERFORMANCE_LAB_SOURCE_ID = 'event-performance-lab-example'",
      path: "packages/scenarios/src/performance-lab.example.tsx",
    },
    load: async () =>
      (await import("./performance-lab")).performanceLabScenario,
  };

const cleanupStressMetadata: ScenarioMetadata = {
  id: "runtime-cleanup-stress",
  slug: "runtime-cleanup-stress",
  title: "Runtime cleanup stress laboratory",
  summary:
    "Exercise pending frames, image races, nested layers, synchronous hook cleanup, component/root identity, runtime disposal, and repeated mount cycles.",
  category: "Diagnostics",
  apiTags: ["crc", "useReaction", "Image", "Layer", "Rectangle"],
  conceptTags: [
    "resource ownership",
    "async cleanup",
    "idempotent disposal",
    "mount stress",
  ],
  manualSteps: [
    {
      action:
        "Choose Dispose with pending frame, then Cleanup again, Remount runtime, and Queue frame.",
      expected:
        "The atomic disposal cancels its pending revision, repeated cleanup remains harmless, and the remounted queued frame settles normally.",
    },
    {
      action:
        "Show the primary image, change its source, try the broken source, then remove it while switching quickly.",
      expected:
        "Blue and pink data images appear for their current source; broken/removed images stay absent and late sources never repaint.",
    },
    {
      action:
        "Add a single layer, replace it with nested layers, then remove layers.",
      expected:
        "Orange then green content appears; removal restores the background with no stale layer pixels.",
    },
    {
      action:
        "Change the hook dependency, replace the component key, remove/restore the component, and replace the root.",
      expected:
        "The blue/purple probe follows the selected identity while hook acquired/cleaned counters advance exactly once per boundary.",
    },
    {
      action:
        "Choose Run 1,000 mount/dispose cycles, then Cleanup again and Reset.",
      expected:
        "The cycle counter reaches 1,000, one live scene remains, repeated cleanup is harmless, and Reset returns to the initial probe.",
    },
  ],
  knownLimitations: [
    "Private instance, frame, reference, image-handler, and teardown ledgers remain test-only; the gallery exposes the exact public controls and semantic state.",
    "The 1,000-cycle control settles every render before disposal; it takes roughly one display-frame interval per cycle in an unaccelerated browser.",
    "The broken-image case has no public error callback; its contract is absence of stale pixels, scheduled work, and late updates.",
  ],
  learningOrder: 120,
  visibility: "test-laboratory",
  visibilityReason:
    "It exposes lifecycle stress, failure sources, and ownership counters rather than a beginner-facing drawing example.",
  maturity: "trusted",
};

export const cleanupStressScenarioEntry: ScenarioCatalogEntry<CleanupStressState> =
  {
    metadata: cleanupStressMetadata,
    canvas: { width: 480, height: 240 },
    actions: [
      { id: "queue-frame", label: "Queue frame" },
      { id: "dispose-with-frame", label: "Dispose with pending frame" },
      { id: "show-image", label: "Show primary image" },
      { id: "change-image-source", label: "Change image source" },
      { id: "show-broken-image", label: "Show broken image" },
      { id: "remove-image", label: "Remove image" },
      { id: "add-layer", label: "Add layer" },
      { id: "add-nested-layer", label: "Add nested layers" },
      { id: "remove-layers", label: "Remove layers" },
      { id: "change-hook-dependency", label: "Change hook dependency" },
      { id: "replace-component-key", label: "Replace component key" },
      { id: "remove-component", label: "Remove component" },
      { id: "restore-component", label: "Restore component" },
      { id: "replace-root", label: "Replace root" },
      { id: "abort-runtime", label: "Abort runtime" },
      { id: "dispose-runtime", label: "Dispose runtime" },
      { id: "cleanup-again", label: "Cleanup again" },
      { id: "remount-runtime", label: "Remount runtime" },
      { id: "cycle-runtime-1000", label: "Run 1,000 mount/dispose cycles" },
    ],
    source: {
      id: "runtime-cleanup-stress-example",
      language: "tsx",
      marker: "CLEANUP_STRESS_SOURCE_ID = 'runtime-cleanup-stress-example'",
      path: "packages/scenarios/src/cleanup-stress.example.tsx",
    },
    load: async () => (await import("./cleanup-stress")).cleanupStressScenario,
  };

const runtimeHooksMetadata: ScenarioMetadata = {
  id: "runtime-hooks-laboratory",
  slug: "runtime-hooks-laboratory",
  title: "Runtime and hooks laboratory",
  summary:
    "Exercise state, memo, ref, synchronous change cleanup, memoized paths, keyed siblings, root identity, falsy children, and public hook misuse.",
  category: "Diagnostics",
  apiTags: [
    "crc",
    "useSignal",
    "useComputed",
    "useRef",
    "useReaction",
    "useRectPath",
    "useLinePath",
    "useSvgPath",
    "useCursor",
  ],
  conceptTags: [
    "hook identity",
    "keyed reconciliation",
    "dependency cleanup",
    "runtime recovery",
  ],
  manualSteps: [
    {
      action: "Choose Increment state, Mutate ref, and Stable render.",
      expected:
        "State changes the blue probe to purple and renders; the ref value changes without rendering; stable render preserves memo, ref, and all three path identities.",
    },
    {
      action: "Choose Change dependency.",
      expected:
        "Memo and all three paths receive new identities, the triangle turns pink, and one previous change cleanup balances the new acquisition.",
    },
    {
      action: "Reorder siblings, Insert sibling, and Remove sibling.",
      expected:
        "The sky, green, and orange blocks follow the visible order while every surviving keyed sibling retains its identity.",
    },
    {
      action:
        "Replace component key, Remove component, Restore component, and Replace root.",
      expected:
        "Key and root replacement create fresh hook identities, removal clears the probe and runs its cleanup, and restoration mounts a fresh probe.",
    },
    {
      action:
        "Choose Probe hook misuse, verify the scene remains responsive, then Reset.",
      expected:
        "All nine hooks report the same exact outside-render diagnostic, the recovery render preserves live identities, and Reset restores the exact initial counters and pixels.",
    },
  ],
  knownLimitations: [
    "useEvent is exercised by the ordering and overlap laboratory; this scenario covers useCursor slot identity while the interaction laboratories own its geometry and lifecycle matrix.",
    "A conditional hook-count mismatch is intentionally not exposed as a gallery action because it can corrupt the diagnostic scene; focused runtime tests own that explicit misuse contract.",
    "Displayed identity numbers are deterministic laboratory labels, not public runtime identifiers.",
  ],
  learningOrder: 130,
  visibility: "test-laboratory",
  visibilityReason:
    "It exposes hook identities, cleanup counts, keyed reconciliation, and deliberate misuse rather than beginner-facing API guidance.",
  maturity: "trusted",
};

export const runtimeHooksScenarioEntry: ScenarioCatalogEntry<RuntimeHooksState> =
  {
    metadata: runtimeHooksMetadata,
    canvas: { width: 480, height: 240 },
    actions: [
      { id: "increment-state", label: "Increment state" },
      { id: "mutate-ref", label: "Mutate ref" },
      { id: "render-stable", label: "Stable render" },
      { id: "change-dependency", label: "Change dependency" },
      { id: "reorder-siblings", label: "Reorder siblings" },
      { id: "insert-sibling", label: "Insert sibling" },
      { id: "remove-sibling", label: "Remove sibling" },
      { id: "replace-component-key", label: "Replace component key" },
      { id: "remove-component", label: "Remove component" },
      { id: "restore-component", label: "Restore component" },
      { id: "replace-root", label: "Replace root" },
      { id: "probe-hook-misuse", label: "Probe hook misuse" },
    ],
    source: {
      id: "runtime-hooks-laboratory-example",
      language: "tsx",
      marker: "RUNTIME_HOOKS_SOURCE_ID = 'runtime-hooks-laboratory-example'",
      path: "packages/scenarios/src/runtime-hooks.example.tsx",
    },
    load: async () => (await import("./runtime-hooks")).runtimeHooksScenario,
  };

const layoutFoundationMetadata: ScenarioMetadata = {
  id: "layout-foundation",
  slug: "layout-foundation",
  title: "Layout foundation laboratory",
  summary:
    "Prove nested Flex, Grid, Overlay, clipping, measurement, observation, and keyed reflow.",
  category: "Layout diagnostics",
  apiTags: [
    "Absolute",
    "Flex",
    "Grid",
    "Overlay",
    "useLayoutBox",
    "Text",
    "Image",
  ],
  conceptTags: [
    "nested layout",
    "percentage reflow",
    "clipping",
    "keyed identity",
  ],
  manualSteps: [
    {
      action:
        "Inspect the initial 720 × 420 composition and click its center, corner, and clipped lower edge.",
      expected:
        "The topmost orange target wins at center, the keyed teal region retains state, and purple paint and hits stop at the overlay boundary.",
    },
    {
      action: "Choose Resize layout.",
      expected:
        "The Canvas becomes 480 × 360, the observed local box changes from 432 × 420 to 288 × 360, and keyed state remains intact.",
    },
  ],
  knownLimitations: [
    "This laboratory covers the approved explicit layout subsets; scrolling, implicit Grid placement, and advanced intrinsic CSS sizing remain deferred.",
  ],
  learningOrder: 140,
  visibility: "test-laboratory",
  visibilityReason:
    "It exposes exact allocations and state counters for deterministic integration evidence.",
  maturity: "contract",
};

export const layoutFoundationScenarioEntry: ScenarioCatalogEntry<LayoutFoundationState> =
  {
    metadata: layoutFoundationMetadata,
    canvas: { width: 720, height: 420 },
    actions: [{ id: "resize", label: "Resize layout" }],
    source: {
      id: "layout-foundation-example",
      language: "tsx",
      marker: "LAYOUT_FOUNDATION_SOURCE_ID = 'layout-foundation-example'",
      path: "packages/scenarios/src/layout-foundation.example.tsx",
    },
    load: async () => (await import("./layout-foundation.example")).default,
  };

const canvasSurfaceMetadata: ScenarioMetadata = {
  id: "canvas-surface",
  slug: "canvas-surface",
  title: "Canvas surface laboratory",
  summary:
    "Verify fixed fitting, responsive logical reflow, high-density backing stores, and logical mouse coordinates.",
  category: "Rendering",
  apiTags: ["crc", "useLayoutBox", "Rectangle", "Text", "mouse events"],
  conceptTags: [
    "device pixel ratio",
    "responsive Canvas",
    "logical viewport",
    "fit projection",
  ],
  manualSteps: [
    {
      action: "Choose Resize fixed.",
      expected:
        "The Canvas grows to 720 × 360 CSS and 1440 × 720 backing pixels while the logical viewport and component identity remain 480 × 240.",
    },
    {
      action: "Choose Show responsive, then Resize responsive.",
      expected:
        "The logical viewport follows the CSS content box, the backing remains 2×, and identity survives the responsive resize.",
    },
    {
      action: "Move over the Canvas center.",
      expected:
        "The reported coordinates use logical units rather than physical backing pixels.",
    },
  ],
  knownLimitations: [
    "Projection alignment is centered and not configurable in this release.",
    "The laboratory uses numeric pixel ratio 2 for deterministic evidence; default mounts use the live device ratio.",
  ],
  learningOrder: 150,
  visibility: "test-laboratory",
  visibilityReason:
    "It exposes exact surface geometry and density state for deterministic integration evidence.",
  maturity: "contract",
};

const filterLabMetadata: ScenarioMetadata = {
  id: "first-class-filters",
  slug: "filters",
  title: "First-class filters laboratory",
  summary:
    "Compare every supported filter, order-sensitive chains, nested boundaries, transforms, clips, and cached Layer interaction.",
  category: "Rendering",
  apiTags: ["Group", "Clip", "Layer", "Image", "CRCFilter"],
  conceptTags: [
    "filter order",
    "combined silhouette",
    "nested boundaries",
    "visual overflow",
    "source geometry",
  ],
  manualSteps: [
    {
      action: "Choose All filters.",
      expected:
        "Ten labeled fixed-size swatches show blur, brightness, contrast, drop shadow, grayscale, hue rotation, invert, opacity, saturate, and sepia.",
    },
    {
      action: "Choose Ordered chain, then Swap order.",
      expected:
        "The same source geometry remains in place while the shadow changes because the filter list receives pixels in declaration order.",
    },
    {
      action: "Choose Nested, Transformed, and Clipped.",
      expected:
        "Nested effects resolve inside-out, transform after their upright capture, and same/ancestor/descendant clips affect completed output at their respective boundary.",
    },
    {
      action:
        "Choose Cached Layer, click the blue source, then click its shadow.",
      expected:
        "Only the original blue source geometry records layered-source; shadow-only pixels remain visual overflow rather than a target.",
    },
  ],
  knownLimitations: [
    "Canvas filter rasterization and color math are browser-owned; this deterministic laboratory is reviewed against the provisioned Chromium environment.",
    "Filter pixels do not change layout, focus, cursor, clipping geometry, or logical hit regions.",
  ],
  learningOrder: 160,
  visibility: "test-laboratory",
  visibilityReason:
    "It is a dense public-API conformance matrix with stable state and pixel probes rather than a beginner-facing lesson.",
  maturity: "trusted",
};

export const filterLabScenarioEntry: ScenarioCatalogEntry<FilterLabState> = {
  metadata: filterLabMetadata,
  canvas: { width: 480, height: 240 },
  actions: [
    { id: "show-all", label: "All filters" },
    { id: "show-ordered", label: "Ordered chain" },
    { id: "swap-order", label: "Swap order" },
    { id: "show-nested", label: "Nested boundaries" },
    { id: "show-transformed", label: "Transformed filters" },
    { id: "show-clipped", label: "Clip positions" },
    { id: "show-layered", label: "Cached Layer" },
  ],
  source: {
    id: "first-class-filters-laboratory-example",
    language: "tsx",
    marker: "FILTER_LAB_SOURCE_ID = 'first-class-filters-laboratory-example'",
    path: "packages/scenarios/src/filter-lab.example.tsx",
  },
  load: async () => (await import("./filter-lab")).filterLabScenario,
};

const threeInstancingLabMetadata: ScenarioMetadata = {
  id: "three-instancing",
  slug: "three-instancing",
  title: "Three.js instancing integration laboratory",
  summary:
    "Prove mixed CRC and Three paint order, instanced blocking, registered targets, miss policies, bridged orbit input, focus, clip/filter composition, resize, and cleanup.",
  category: "Rendering",
  apiTags: [
    "defineThreeLayer",
    "InstancedMesh",
    "OrbitControls",
    "missBehavior",
  ],
  conceptTags: [
    "flattened Three layer",
    "interaction arbitration",
    "registered Three target",
    "CRC scheduling",
    "Canvas composition",
  ],
  manualSteps: [
    {
      action:
        "Click an exposed tile, an empty projected gap, an ordinary instance, the gold registered icosahedron, and the foreground toolbar.",
      expected:
        "The gap reaches the lower tile under pass-through, ordinary instances report Three blocked, the gold target records capture/target/bubble, and the later toolbar wins without bridge input.",
    },
    {
      action:
        "Cycle pass-through to block and target-layer, then drag across the empty gap.",
      expected:
        "Block leaves the lower tile untouched; target-layer routes the empty-space drag to OrbitControls through CRC and reports a camera change.",
    },
    {
      action:
        "Tab to the registered target and press Enter or Space, then choose Resize layer.",
      expected:
        "Keyboard activation follows the same CRC propagation trace and the existing Three resources resize into a newly composed bitmap.",
    },
  ],
  knownLimitations: [
    "The proving scene requires WebGL2, OffscreenCanvas, and ImageBitmap transfer in the host browser.",
    "The instanced mesh intentionally remains one blocking Three object rather than registering every instance as a CRC target.",
  ],
  learningOrder: 177,
  visibility: "test-laboratory",
  visibilityReason:
    "It exposes deterministic interaction probes and resource cleanup for the public Three adapter while the learning example remains the approachable presentation.",
  maturity: "contract",
};

export const threeInstancingLabScenarioEntry: ScenarioCatalogEntry<ThreeInstancingLabState> =
  {
    metadata: threeInstancingLabMetadata,
    canvas: { width: 640, height: 360 },
    actions: [
      { id: "cycle-miss-behavior", label: "Cycle miss behavior" },
      { id: "resize-layer", label: "Resize layer" },
    ],
    source: {
      id: "three-instancing-laboratory-example",
      language: "tsx",
      marker:
        "THREE_INSTANCING_LAB_SOURCE_ID = 'three-instancing-laboratory-example'",
      path: "packages/scenarios/src/three-instancing-lab.example.tsx",
    },
    load: async () =>
      (await import("./three-instancing-lab")).threeInstancingLabScenario,
  };

const signalsLabMetadata: ScenarioMetadata = {
  id: "first-class-signals",
  slug: "signals",
  title: "First-class signals laboratory",
  summary:
    "Prove receiver-owned inputs, batching, reactions, computed barriers, shared roots, Layer isolation, and consumer cleanup through public CRC APIs.",
  category: "Rendering",
  apiTags: ["crc", "signal", "computed", "useSignal", "Layer"],
  conceptTags: [
    "explicit dependency",
    "equal write",
    "dynamic dependencies",
    "shared scheduler",
    "layer reuse",
    "consumer cleanup",
    "signal inputs",
    "batching",
    "reactions",
  ],
  manualSteps: [
    {
      action: "Choose Direct write, then Equal write.",
      expected:
        "The direct value and root A render count advance once; the equal write leaves the render counters unchanged.",
    },
    {
      action: "Choose Computed-equal write, then Dependency switch.",
      expected:
        "The computed evaluates to confirm equality without a root redraw, then follows the right source after the dynamic branch changes.",
    },
    {
      action: "Choose Shared roots and Layer-local write.",
      expected:
        "One logical shared update advances both roots, while a Layer A update refreshes its child before root A presents the new pixels and Layer B remains reused.",
    },
    {
      action: "Choose Batched write, then Reaction-only.",
      expected:
        "Two writes flush once and repaint both roots once; the reaction-only write runs cleanup/setup without repainting either root.",
    },
    {
      action: "Choose Remove consumer, then Reset.",
      expected:
        "The retained consumer disappears before its retained signal is written; reset recreates the original two-root scene and workload counters.",
    },
  ],
  knownLimitations: [
    "The counters describe deterministic public-scene work; scheduler internals remain covered by the dedicated core scheduler tests.",
    "Layers retain their existing browser OffscreenCanvas requirement and only demonstrate cache reuse for their local public child output.",
  ],
  learningOrder: 180,
  visibility: "test-laboratory",
  visibilityReason:
    "It exposes deterministic structural counters and teardown controls rather than a beginner-facing visual lesson.",
  maturity: "trusted",
};

export const signalsLabScenarioEntry: ScenarioCatalogEntry<SignalsLabState> = {
  metadata: signalsLabMetadata,
  canvas: { width: 480, height: 240 },
  actions: [
    { id: "direct-write", label: "Direct write" },
    { id: "equal-write", label: "Equal write" },
    { id: "computed-equal-write", label: "Computed-equal write" },
    { id: "dependency-switch", label: "Dependency switch" },
    { id: "shared-roots", label: "Shared roots" },
    { id: "layer-local-write", label: "Layer-local write" },
    { id: "remove-consumer", label: "Remove consumer" },
    { id: "batched-write", label: "Batched write" },
    { id: "reaction-only", label: "Reaction-only" },
    { id: "reset", label: "Reset" },
  ],
  source: {
    id: "first-class-signals-laboratory-example",
    language: "tsx",
    marker: "SIGNALS_LAB_SOURCE_ID = 'first-class-signals-laboratory-example'",
    path: "packages/scenarios/src/signals-lab.example.tsx",
  },
  load: async () => (await import("./signals-lab")).signalsLabScenario,
};

const animationLabMetadata: ScenarioMetadata = {
  id: "first-class-animation",
  slug: "animation",
  title: "First-class animation laboratory",
  summary:
    "Drive deterministic playback, transitions, composition, simulation, Layer reuse, shared roots, and owner teardown through public CRC APIs.",
  category: "Rendering",
  apiTags: [
    "usePlayback",
    "useTransition",
    "tween",
    "spring",
    "stepper",
    "sequence",
    "parallel",
    "repeat",
    "marker",
    "Layer",
  ],
  conceptTags: [
    "central scheduler",
    "deterministic time",
    "milestones",
    "retarget continuity",
    "fixed-step simulation",
    "owner teardown",
  ],
  manualSteps: [
    {
      action: "Choose Play, Pause, Step, or one of the fixed Seek controls.",
      expected:
        "The status, logical time, numeric outputs, and normalized public milestone transcript update together.",
    },
    {
      action: "Choose Retarget, Repeat, or Simulate.",
      expected:
        "A successful render adopts the next target or immutable program before its owned run begins.",
    },
    {
      action: "Choose Show Layer, then Show shared roots.",
      expected:
        "Layer presentation reuses its stable child bitmap, while one committed shared value is visible to both roots.",
    },
    {
      action: "Choose Cancel or Remove owner, then Reset.",
      expected:
        "Cancel retains committed values; removing the component disposes its stale playback handle; Reset recreates an independent initial scene.",
    },
  ],
  knownLimitations: [
    "The laboratory exposes normalized public milestone events, not the source-only scheduler trace or a public manual clock.",
    "Layer presentation count measures the public wrapper that precedes bitmap composition; native drawImage counters remain internal test evidence.",
  ],
  learningOrder: 190,
  visibility: "test-laboratory",
  visibilityReason:
    "It exposes exact clocks, counters, event transcripts, and teardown diagnostics for deterministic browser evidence.",
  maturity: "trusted",
};

export const animationLabScenarioEntry: ScenarioCatalogEntry<AnimationLabState> =
  {
    metadata: animationLabMetadata,
    canvas: { width: 480, height: 240 },
    actions: [
      { id: "play", label: "Play" },
      { id: "pause", label: "Pause" },
      { id: "step", label: "Step 16.667 ms" },
      { id: "seek-start", label: "Seek start" },
      { id: "seek-middle", label: "Seek middle" },
      { id: "seek-end", label: "Seek end" },
      { id: "reverse", label: "Reverse" },
      { id: "retarget", label: "Retarget" },
      { id: "repeat", label: "Repeat alternate" },
      { id: "simulate", label: "Simulate" },
      { id: "show-layer", label: "Show Layer reuse" },
      { id: "show-shared-roots", label: "Show shared roots" },
      { id: "cancel", label: "Cancel" },
      { id: "remove-owner", label: "Remove owner" },
      { id: "reset", label: "Reset" },
    ],
    source: {
      id: "first-class-animation-laboratory-example",
      language: "tsx",
      marker:
        "ANIMATION_LAB_SOURCE_ID = 'first-class-animation-laboratory-example'",
      path: "packages/scenarios/src/animation-lab.example.tsx",
    },
    load: async () => (await import("./animation-lab")).animationLabScenario,
  };

const particleCelebrationLabMetadata: ScenarioMetadata = {
  id: "first-class-particle-celebration",
  slug: "particle-celebration",
  title: "Canvas particle celebration laboratory",
  summary:
    "Place launch points and trigger a colorful Canvas particle celebration through public CRC APIs.",
  category: "Rendering",
  apiTags: [
    "defineParticleEffect2D",
    "particleRange",
    "particleChoice",
    "particleCurve",
    "useParticleSystem",
    "Particles2D",
    "Clip",
    "Layer",
  ],
  conceptTags: ["particle effects", "pointer bursts", "Canvas composition"],
  manualSteps: [
    {
      action: "Click one or two points in the dark stage.",
      expected:
        "Numbered launch markers remain visible so you can see exactly where the celebration will begin.",
    },
    {
      action: "Choose Launch celebration.",
      expected:
        "Sparkles and confetti originate at every selected point, and the launch markers clear.",
    },
    {
      action: "Try Pause animation, Resume animation, Replay, and Clear stage.",
      expected:
        "The animation pauses and resumes; Replay repeats the last seeded launch; Clear stage removes the active effect.",
    },
    {
      action: "Choose Glow on / off, then Reset.",
      expected:
        "Glow changes the presentation, while Reset returns the entire example to its initial state.",
    },
  ],
  knownLimitations: [
    "Canvas particle execution is CPU paint optimized and does not claim portable GPU acceleration.",
    "The whole declared component box is the optional pointer target; individual particles are not retained targets.",
  ],
  learningOrder: 200,
  visibility: "test-laboratory",
  visibilityReason:
    "It provides an interactive public-API test surface for pointer launches, playback controls, and Canvas composition.",
  maturity: "contract",
};

export const particleCelebrationLabScenarioEntry: ScenarioCatalogEntry<ParticleCelebrationLabState> =
  {
    metadata: particleCelebrationLabMetadata,
    canvas: { width: 640, height: 360 },
    actions: [
      { id: "launch", label: "Launch celebration" },
      { id: "pause", label: "Pause animation" },
      { id: "resume", label: "Resume animation" },
      { id: "replay", label: "Replay" },
      { id: "clear", label: "Clear stage" },
      { id: "toggle-glow", label: "Glow on / off" },
    ],
    source: {
      id: "first-class-particle-celebration-laboratory-example",
      language: "tsx",
      marker:
        "PARTICLE_CELEBRATION_LAB_SOURCE_ID = 'first-class-particle-celebration-laboratory-example'",
      path: "packages/scenarios/src/particle-celebration-lab.example.tsx",
    },
    load: async () =>
      (await import("./particle-celebration-lab"))
        .particleCelebrationLabScenario,
  };

const physics2DLabMetadata: ScenarioMetadata = {
  id: "first-class-physics-2d",
  slug: "physics-2d",
  title: "First-class 2D physics laboratory",
  summary:
    "Drive rigid bodies, sensors, queries, a kinematic animation target, and explicit animation-to-physics pose ownership through public CRC APIs.",
  category: "Simulation",
  apiTags: [
    "PhysicsWorld2D",
    "dynamicBody2D",
    "staticBody2D",
    "kinematicBody2D",
    "collider2D",
    "crcPhysicsBody2D",
    "crcPhysicsWorld2D",
    "applyImpulse2D",
    "disableBody2D",
    "enableBody2D",
    "queryAabb2D",
    "tween",
  ],
  conceptTags: [
    "fixed-step physics",
    "central scheduler",
    "collision ordering",
    "sensor overlap",
    "kinematic target",
    "pose ownership handoff",
    "world queries",
  ],
  manualSteps: [
    {
      action: "Observe natural settling, then choose Impulse circle.",
      expected:
        "The circle changes from sleeping to awake and its authoritative velocity reports the impulse.",
    },
    {
      action: "Choose Cross sensor, Move platform, and Query world.",
      expected:
        "Sensor receiver records stay ordered while the mover exits, the kinematic platform follows its animated target, and public query tags list matching colliders.",
    },
    {
      action: "Choose Disable handoff, then Transfer animation.",
      expected:
        "The orange ball keeps its presented pose, moves under a CRC tween while disabled, and returns to physics with zero velocity after completion.",
    },
    {
      action: "Choose Re-enable handoff, Remove owner, or Reset.",
      expected:
        "Named commands restore physics ownership, component removal preserves the last generation snapshot, and Reset creates a fresh scene.",
    },
  ],
  knownLimitations: [
    "The laboratory presents semantic body, event, and query snapshots; screenshot baselines are maintained by the later visual verification pass.",
    "The example uses one fixed logical viewport and Chromium Canvas behavior rather than a public manual physics clock.",
  ],
  learningOrder: 210,
  visibility: "test-laboratory",
  visibilityReason:
    "It exposes authoritative poses, velocities, generations, event order, and ownership stages for deterministic browser evidence.",
  maturity: "contract",
};

export const physics2DLabScenarioEntry: ScenarioCatalogEntry<Physics2DLabState> =
  {
    metadata: physics2DLabMetadata,
    canvas: { width: 480, height: 240 },
    actions: [
      { id: "settle", label: "Observe settling" },
      { id: "impulse", label: "Impulse circle" },
      { id: "cross-sensor", label: "Cross sensor" },
      { id: "move-platform", label: "Move platform" },
      { id: "query", label: "Query world" },
      { id: "disable-handoff", label: "Disable handoff" },
      { id: "transfer-animation", label: "Transfer animation" },
      { id: "reenable-handoff", label: "Re-enable handoff" },
      { id: "remove-owner", label: "Remove owner" },
    ],
    source: {
      id: "first-class-physics-2d-laboratory-example",
      language: "tsx",
      marker:
        "PHYSICS_2D_LAB_SOURCE_ID = 'first-class-physics-2d-laboratory-example'",
      path: "packages/scenarios/src/physics-2d-lab.example.tsx",
    },
    load: async () => (await import("./physics-2d-lab")).physics2DLabScenario,
  };

export const canvasSurfaceScenarioEntry: ScenarioCatalogEntry<CanvasSurfaceState> =
  {
    metadata: canvasSurfaceMetadata,
    canvas: { width: 480, height: 240 },
    actions: [
      { id: "resize-fixed", label: "Resize fixed" },
      { id: "show-responsive", label: "Show responsive" },
      { id: "resize-responsive", label: "Resize responsive" },
    ],
    source: {
      id: "canvas-surface-example",
      language: "tsx",
      marker: "CANVAS_SURFACE_SOURCE_ID = 'canvas-surface-example'",
      path: "packages/scenarios/src/canvas-surface.example.tsx",
    },
    load: async () => (await import("./canvas-surface")).canvasSurfaceScenario,
  };

export const vizFoundationScenarioEntry: ScenarioCatalogEntry<
  import("./viz-foundation-lab.js").VizFoundationState
> = {
  metadata: {
    id: "viz-foundation-lab",
    slug: "viz-foundation-lab",
    title: "Visualization foundation laboratory",
    summary:
      "Observe the static NOAA record through linked detail and overview plots.",
    category: "Visualization",
    apiTags: ["Scale", "LineSeries", "Axis"],
    conceptTags: ["local allocation", "signals"],
    manualSteps: [
      {
        action:
          "Inspect a month, choose a decade in the overview, and resize the Canvas.",
        expected:
          "Readouts show source values; the detail range changes while the overview stays fixed.",
      },
    ],
    knownLimitations: [
      "Linear scales and curves only; no cross-Layer scope lookup.",
    ],
    learningOrder: 310,
    visibility: "test-laboratory",
    visibilityReason:
      "Exposes deterministic scale readings for headless checks.",
    maturity: "contract",
  },
  canvas: { width: 1100, height: 680 },
  actions: [
    { id: "full", label: "Full record" },
    { id: "reset", label: "Last 10 years" },
  ],
  source: {
    id: "viz-foundation-example",
    language: "tsx",
    marker: "VIZ_FOUNDATION_SOURCE_ID = 'viz-foundation-example'",
    path: "packages/scenarios/src/learning/composition/viz-responsive-line.example.tsx",
  },
  load: async () =>
    (await import("./viz-foundation-lab.js")).vizFoundationScenario,
};

export const manipulationLabScenarioEntry: ScenarioCatalogEntry<ManipulationLabState> = {
  metadata: {
    id: "component-manipulation",
    slug: "manipulation",
    title: "Component manipulation laboratory",
    summary:
      "Drive one signal-owned card through real drag, resizing, snapping, cancellation, and external geometry replacement.",
    category: "Interaction",
    apiTags: [
      "useManipulation",
      "ManipulationFrame",
      "DragHandle",
      "ResizeHandles",
      "signal",
    ],
    conceptTags: [
      "pointer capture",
      "snapping",
      "cancellation",
      "signal ownership",
    ],
    manualSteps: [
      {
        action: "Drag the title and resize a corner.",
        expected: "The numeric box readout follows the signal-owned geometry.",
      },
      {
        action: "Toggle snap, then drag again.",
        expected: "Movement resolves to the 20-pixel lattice.",
      },
      {
        action:
          "Start a drag, then trigger Cancel or external write in the laboratory controls.",
        expected: "Cancellation restores the preview while an external write wins.",
      },
    ],
    knownLimitations: [
      "This private laboratory is an automated conformance fixture, not a learning example or an input-injection API.",
    ],
    learningOrder: 131,
    visibility: "test-laboratory",
    visibilityReason:
      "It exposes public signal state for deterministic native pointer evidence.",
    maturity: "contract",
  },
  canvas: { width: 480, height: 300 },
  actions: MANIPULATION_LAB_ACTION_IDS.map((id) => ({
    id,
    label: {
      "toggle-snap": "Toggle snap",
      cancel: "Cancel gesture",
      "external-write": "External geometry",
    }[id],
  })),
  source: {
    id: "component-manipulation-laboratory-example",
    language: "tsx",
    marker: 'MANIPULATION_LAB_SOURCE_ID = "component-manipulation-laboratory-example"',
    path: "packages/scenarios/src/manipulation-lab.example.tsx",
  },
  load: async () => (await import("./manipulation-lab")).manipulationLabScenario,
};

export const vizPointsScenarioEntry: ScenarioCatalogEntry<
  import("./viz-points-lab.js").VizPointsState
> = {
  metadata: {
    id: "viz-points-lab",
    slug: "viz-points-lab",
    title: "Points and custom plots laboratory",
    summary: "Inspect allocated points and keyed custom marks.",
    category: "Visualization",
    apiTags: ["PointSeries", "PlotSeries", "nearestPoint"],
    conceptTags: ["local allocation", "identity"],
    manualSteps: [
      {
        action: "Inspect, click custom marks, reorder, and resize.",
        expected: "Mapped positions update and keyed state survives.",
      },
    ],
    knownLimitations: [
      "Linear scales; custom marks retain normal component overhead.",
    ],
    learningOrder: 311,
    visibility: "test-laboratory",
    visibilityReason: "Deterministic public point and custom subtree evidence.",
    maturity: "contract",
  },
  canvas: { width: 1100, height: 680 },
  actions: [
    { id: "reorder", label: "Reorder" },
    { id: "remove-selected", label: "Remove selected" },
    { id: "reset", label: "Reset" },
    { id: "next", label: "Next" },
    { id: "previous", label: "Previous" },
  ],
  source: {
    id: "viz-points-example",
    language: "tsx",
    marker: "VIZ_POINTS_SOURCE_ID = 'viz-points-example'",
    path: "packages/scenarios/src/learning/composition/viz-points-and-inspection.example.tsx",
  },
  load: async () => (await import("./viz-points-lab.js")).vizPointsScenario,
};

export const vizHoverScenarioEntry: ScenarioCatalogEntry<
  import("./viz-hover-lab.js").VizHoverState
> = {
  metadata: {
    id: "viz-hover-lab",
    slug: "viz-hover-lab",
    title: "Hover query comparison laboratory",
    summary:
      "Compare nearest and interpolated data queries with a movable inspection guide.",
    category: "Visualization",
    apiTags: [
      "HoverData",
      "HoverCard",
      "closestPoint",
      "closestX",
      "interpolateX",
    ],
    conceptTags: ["inspection", "interpolation"],
    manualSteps: [
      {
        action: "Switch query mode and move or drag the guide.",
        expected: "Recorded and estimated results follow the specified query.",
      },
    ],
    knownLimitations: ["Linear scales; no extrapolation."],
    learningOrder: 312,
    visibility: "test-laboratory",
    visibilityReason: "Deterministic query and drag evidence.",
    maturity: "contract",
  },
  canvas: { width: 1000, height: 620 },
  actions: [
    { id: "closest-point", label: "Closest point" },
    { id: "nearest-per-line", label: "Nearest per line" },
    { id: "interpolated-x", label: "Interpolate" },
    { id: "update-data", label: "Update first series" },
    { id: "missing-data", label: "Insert missing observation" },
    { id: "zero-missing-invalid", label: "Zero, missing and invalid values" },
    { id: "duplicate-first", label: "Duplicate x: first row" },
    { id: "duplicate-last", label: "Duplicate x: last row" },
    { id: "duplicate-reordered", label: "Reorder duplicate rows" },
    { id: "nearest-unsorted", label: "Nearest: unsorted rows" },
    { id: "empty-data", label: "Nearest: empty first series" },
    { id: "weighted-data", label: "Weighted aggregation" },
    { id: "weighted-data-bug", label: "Inject wrong average" },
    { id: "async-start-old", label: "Start older request" },
    { id: "async-start-new", label: "Start newer request / retry" },
    { id: "async-resolve-old", label: "Complete older request" },
    { id: "async-resolve-new", label: "Complete newer request" },
    { id: "async-reject-old", label: "Fail older request" },
    { id: "async-reject-new", label: "Fail newer request" },
    { id: "reset", label: "Reset" },
  ],
  source: {
    id: "viz-hover-example",
    language: "tsx",
    marker: "VIZ_HOVER_SOURCE_ID = 'viz-hover-example'",
    path: "packages/scenarios/src/learning/composition/viz-hover-comparison.example.tsx",
  },
  load: async () => (await import("./viz-hover-lab.js")).vizHoverScenario,
};

export const responsiveStylesScenarioEntry: ScenarioCatalogEntry<ResponsiveStylesState> =
  {
    metadata: {
      id: "responsive-styles",
      slug: "responsive-styles",
      title: "Responsive style thresholds",
      summary:
        "Deterministic allocated width and height queries with signal updates and stable identity.",
      category: "Layout",
      apiTags: ["Flow", "Grid", "signal", "useLayoutBox"],
      conceptTags: ["responsive styles", "allocation", "ownership"],
      manualSteps: [
        {
          action:
            "Cross root and cell width 600 in both directions, then change cell height across 120.",
          expected:
            "The second target changes arrangement and gap while its identity remains stable.",
        },
      ],
      knownLimitations: [
        "Queries change styles only; this is not a mobile chart or touch-usability test.",
      ],
      learningOrder: 129,
      visibility: "test-laboratory",
      maturity: "contract",
      visibilityReason:
        "Exact threshold and identity evidence is separate from the learning example.",
    },
    canvas: { width: 1000, height: 600 },
    actions: RESPONSIVE_STYLE_ACTIONS,
    source: {
      id: "responsive-styles-lab-example",
      language: "tsx",
      marker: "RESPONSIVE_STYLES_SOURCE_ID = 'responsive-styles-lab-example'",
      path: "packages/scenarios/src/responsive-styles-lab.example.tsx",
    },
    load: async () =>
      (await import("./responsive-styles-lab.example"))
        .responsiveStylesScenario,
  };

export const threePickingScenarioEntry: ScenarioCatalogEntry<import('./three-picking-lab.example').ThreePickingState> = {
  metadata: {
    id: 'three-picking-generation', slug: 'three-picking-generation',
    title: 'Three picking generation laboratory',
    summary: 'Separate live scene edits from the displayed bitmap and verify click routing before and after commit.',
    category: 'Rendering', apiTags: ['defineThreeLayer'], conceptTags: ['committed picking', 'generation consistency'],
    manualSteps: [
      { action: 'Choose Mutate without frame, then click the white box at the center.', expected: 'liveVisible is false, displayedVisible is true, and threeClicks increases while frames stays at 1.' },
      { action: 'Choose Commit frame, then click the same position.', expected: 'The box disappears, displayedVisible is false, and canvasClicks increases. Reset restores the box.' },
    ],
    knownLimitations: ['Requires WebGL2 and OffscreenCanvas. This deterministic fixture verifies visibility mutation, not arbitrary custom raycasts.'],
    learningOrder: 178, visibility: 'test-laboratory', maturity: 'contract',
    visibilityReason: 'Exposes intentionally uncommitted scene state for verification, separate from learning examples.',
  },
  canvas: { width: 400, height: 300 },
  actions: [{ id: 'mutate-without-frame', label: 'Mutate without frame' }, { id: 'commit-frame', label: 'Commit frame' }],
  source: { id: 'three-picking-generation-example', language: 'tsx', marker: "THREE_PICKING_SOURCE_ID = 'three-picking-generation-example'", path: 'packages/scenarios/src/three-picking-lab.example.tsx' },
  load: async () => (await import('./three-picking-lab.example')).threePickingScenario,
};

export const scenarioCatalog: readonly AnyScenarioCatalogEntry[] =
  validateScenarioCatalog([
    responsiveStylesScenarioEntry,
    manipulationLabScenarioEntry,
    vizFoundationScenarioEntry,
    vizPointsScenarioEntry,
    vizHoverScenarioEntry,
    smokeScenarioEntry,
    drawingShapesScenarioEntry,
    drawingLinesScenarioEntry,
    drawingTextScenarioEntry,
    drawingImagesScenarioEntry,
    drawingCompositionScenarioEntry,
    focusNavigationScenarioEntry,
    mouseContractScenarioEntry,
    agentTargetingVerificationScenarioEntry,
    agentTextScenarioEntry,
    agentSignalMutationEntry,
    agentLayoutPlacementEntry,
    agentLateFontEntry,
    interactionLabScenarioEntry,
    lifecycleLabScenarioEntry,
    geometryMatrixScenarioEntry,
    performanceLabScenarioEntry,
    cleanupStressScenarioEntry,
    runtimeHooksScenarioEntry,
    layoutFoundationScenarioEntry,
    canvasSurfaceScenarioEntry,
    filterLabScenarioEntry,
    threeInstancingLabScenarioEntry,
    threePickingScenarioEntry,
    signalsLabScenarioEntry,
    animationLabScenarioEntry,
    particleCelebrationLabScenarioEntry,
    physics2DLabScenarioEntry,
  ] as const);

export const scenarioCatalogIndex = createScenarioCatalogIndex(scenarioCatalog);

export function getScenarioBySlug(
  slug: string,
): AnyScenarioCatalogEntry | undefined {
  return scenarioCatalog.find((scenario) => scenario.metadata.slug === slug);
}
