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
import type { LifecycleLabState } from "./lifecycle-lab.example";
import type { LayoutFoundationState } from "./layout-foundation.example";
import type { MouseContractScenarioState } from "./mouse-contract.example";
import type { PerformanceLabState } from "./performance-lab.example";
import type { RuntimeHooksState } from "./runtime-hooks.example";
import type { CanvasSurfaceState } from "./canvas-surface.example";
import type { FilterLabState } from "./filter-lab.example";
import type { WebGLLabState } from "./webgl-lab.example";
import type { SignalsLabState } from "./signals-lab.example";
import type { AnimationLabState } from "./animation-lab.example";
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
    "crcEventTarget",
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
    "crcEvent",
    "crcEventListener",
    "crcEventTarget",
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
  apiTags: ["crc", "crcWhenChanged", "Image", "Layer", "Rectangle"],
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
    "crcState",
    "crcMemo",
    "crcRef",
    "crcWhenChanged",
    "crcRectPath",
    "crcLinePath",
    "crcSvgPath",
    "crcCursor",
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
    "crcEvent is exercised by the ordering and overlap laboratory; this scenario covers crcCursor slot identity while the interaction laboratories own its geometry and lifecycle matrix.",
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
    "crcLayoutBox",
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
  apiTags: ["crc", "crcLayoutBox", "Rectangle", "Text", "mouse events"],
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

const webglLabMetadata: ScenarioMetadata = {
  id: "webgl-islands",
  slug: "webgl-islands",
  title: "WebGL islands laboratory",
  summary:
    "Prove settled transparency, Canvas/WebGL composition, depth picking, transforms, clips, layers, filters, focus, and animation.",
  category: "Rendering",
  apiTags: ["WebGLLayer", "Group3D", "Mesh", "Cube", "Sphere"],
  conceptTags: [
    "settled transparency",
    "depth picking",
    "declarative scene composition",
    "Canvas paint order",
  ],
  manualSteps: [
    {
      action:
        "Compare Mixed order, Depth, Transforms, Clipped, Layered, and Filtered.",
      expected:
        "Visible WebGL geometry composes at one Canvas paint position while depth, transforms, clips, layers, and filter overflow preserve source geometry.",
    },
    {
      action: "Choose Transparency and compare the far-only, overlap, and near-only probes.",
      expected:
        "Although the near mesh appears first in source, the overlap blends the far green mesh before the near red mesh.",
    },
    {
      action:
        "Click the lower Canvas, cube, transparent island background, upper star, and sphere probes.",
      expected:
        "Transparent pixels pass through, visible geometry targets the selected WebGL primitive, and later Canvas paint wins at overlap.",
    },
    {
      action:
        "Choose Focus, use Tab and Enter, then choose Animation and advance it.",
      expected:
        "Logical focus enters the cube, keyboard activation selects it, and the reported angle advances by one deterministic step.",
    },
  ],
  knownLimitations: [
    "The renderer is WebGL2-only and requires OffscreenCanvas plus ImageBitmap transfer.",
    "Picking uses declared CPU triangle geometry; shader discard, texture alpha, blending, and procedural displacement do not alter hit geometry.",
  ],
  learningOrder: 170,
  visibility: "test-laboratory",
  visibilityReason:
    "It exposes nine dense conformance modes and exact geometry, interaction, and transparency probes rather than a single beginner lesson.",
  maturity: "contract",
};

export const webglLabScenarioEntry: ScenarioCatalogEntry<WebGLLabState> = {
  metadata: webglLabMetadata,
  canvas: { width: 480, height: 300 },
  actions: [
    { id: "show-mixed-order", label: "Mixed order" },
    { id: "show-depth", label: "Depth" },
    { id: "show-transparency", label: "Transparency" },
    { id: "show-transforms", label: "Transforms" },
    { id: "show-clipped", label: "Clipped" },
    { id: "show-layered", label: "Layered" },
    { id: "show-filtered", label: "Filtered" },
    { id: "show-focus", label: "Focus" },
    { id: "show-animation", label: "Animation" },
    { id: "change-camera", label: "Change camera" },
    { id: "rotate-scene", label: "Rotate scene" },
    { id: "toggle-pointer-events", label: "Toggle pointer events" },
    { id: "swap-source-order", label: "Swap source order" },
    { id: "advance-animation", label: "Advance animation" },
  ],
  source: {
    id: "webgl-islands-laboratory-example",
    language: "tsx",
    marker: "WEBGL_LAB_SOURCE_ID = 'webgl-islands-laboratory-example'",
    path: "packages/scenarios/src/webgl-lab.example.tsx",
  },
  load: async () => (await import("./webgl-lab")).webglLabScenario,
};

const signalsLabMetadata: ScenarioMetadata = {
  id: "first-class-signals",
  slug: "signals",
  title: "First-class signals laboratory",
  summary:
    "Prove writable, computed, dynamic, shared-root, Layer-local, and removed-consumer signal behavior through public CRC APIs.",
  category: "Rendering",
  apiTags: ["crc", "signal", "computed", "crcSignal", "Layer"],
  conceptTags: [
    "explicit dependency",
    "equal write",
    "dynamic dependencies",
    "shared scheduler",
    "layer reuse",
    "consumer cleanup",
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
      action: "Choose Remove consumer, then Reset.",
      expected:
        "The retained consumer disappears before its retained signal is written; reset recreates the original two-root scene and counters.",
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
    "crcPlayback",
    "crcTransition",
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

export const scenarioCatalog: readonly AnyScenarioCatalogEntry[] =
  validateScenarioCatalog([
    smokeScenarioEntry,
    drawingShapesScenarioEntry,
    drawingLinesScenarioEntry,
    drawingTextScenarioEntry,
    drawingImagesScenarioEntry,
    drawingCompositionScenarioEntry,
    focusNavigationScenarioEntry,
    mouseContractScenarioEntry,
    interactionLabScenarioEntry,
    lifecycleLabScenarioEntry,
    geometryMatrixScenarioEntry,
    performanceLabScenarioEntry,
    cleanupStressScenarioEntry,
    runtimeHooksScenarioEntry,
    layoutFoundationScenarioEntry,
    canvasSurfaceScenarioEntry,
    filterLabScenarioEntry,
    webglLabScenarioEntry,
    signalsLabScenarioEntry,
    animationLabScenarioEntry,
  ] as const);

export const scenarioCatalogIndex = createScenarioCatalogIndex(scenarioCatalog);

export function getScenarioBySlug(
  slug: string,
): AnyScenarioCatalogEntry | undefined {
  return scenarioCatalog.find((scenario) => scenario.metadata.slug === slug);
}
