import type {
  LearningExampleCatalogEntry,
  LearningExampleMetadata,
  LearningSection,
  LearningSectionId,
} from "./learning-types";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const learningSections = [
  {
    id: "start",
    label: "Start",
    description: "Mount your first CRC scene and learn the render contract.",
    order: 1,
  },
  {
    id: "drawing",
    label: "Drawing",
    description: "Build pictures from focused Canvas primitives.",
    order: 2,
  },
  {
    id: "composition",
    label: "Composition",
    description: "Transform, crop, and cache groups of marks.",
    order: 3,
  },
  {
    id: "mouse-events",
    label: "Mouse events",
    description: "Give painted regions visible mouse feedback.",
    order: 4,
  },
  {
    id: "advanced-interactions",
    label: "Advanced interactions",
    description: "Reason about ordering, hit geometry, and composed targets.",
    order: 5,
  },
] as const satisfies readonly LearningSection[];

interface LearningDraft extends Omit<
  LearningExampleMetadata,
  "relationships" | "source"
> {
  related?: readonly string[];
  load: () => Promise<unknown>;
}

function sourcePath(section: LearningSectionId, slug: string): string {
  return `packages/scenarios/src/learning/${section}/${slug}.example.ts`;
}

const drafts = [
  {
    slug: "getting-started",
    title: "Getting started",
    shortTitle: "Getting started",
    section: "start",
    order: 10,
    summary:
      "Mount a tiny poster, then see how CRC turns component functions into one disposable Canvas scene.",
    api: ["crc", "defineComp", "rect", "text"],
    objectives: [
      "Create a component with defineComp and return drawing elements.",
      "Mount the component with crc and keep its controller for cleanup.",
    ],
    prompts: {
      gesture: "Click the cobalt card to change its message.",
      code: "Change the card color or replace “HELLO” with your own title.",
    },
    apiNotes: [
      "`defineComp` turns a render function into an element factory.",
      "`crc` owns one Canvas mount and returns an idempotent controller with `dispose()`.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["rectangle", "text", "click"],
    load: () => import("./learning/start/getting-started.example"),
  },
  {
    slug: "rectangle",
    title: "Rectangle",
    shortTitle: "Rectangle",
    section: "drawing",
    order: 20,
    summary:
      "Use rectangles as bold blocks of color, outlined frames, and precise layout anchors.",
    api: ["rect"],
    objectives: [
      "Position and size a rectangle.",
      "Combine fill, stroke, alpha, and pixel-grid alignment.",
    ],
    prompts: {
      gesture: "Hover the coral block to confirm its target area.",
      code: "Make the yellow square twice as wide and give it a cobalt stroke.",
    },
    apiNotes: [
      "A rectangle can be fill-only, stroke-only, or both.",
      "`alignToPixelGrid` helps thin borders land crisply.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["path", "click", "overlap-and-paint-order"],
    load: () => import("./learning/drawing/rectangle.example"),
  },
  {
    slug: "path",
    title: "Path",
    shortTitle: "Path",
    section: "drawing",
    order: 30,
    summary:
      "Draw custom geometry with the browser’s Path2D vocabulary and let CRC paint it.",
    api: ["path"],
    objectives: [
      "Construct a reusable Path2D.",
      "Paint and target custom filled or stroked geometry.",
    ],
    prompts: {
      gesture: "Move over the mint star and watch the center glow.",
      code: "Add one more point to the star or swap its fill and stroke colors.",
    },
    apiNotes: [
      "CRC accepts a native `Path2D`, so Canvas path commands remain familiar.",
      "Filled paths use their fill geometry for hit testing; strokes can opt into a wider interaction width.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["svg-path", "hit-areas-and-cursors"],
    load: () => import("./learning/drawing/path.example"),
  },
  {
    slug: "svg-path",
    title: "SVG path",
    shortTitle: "SVG path",
    section: "drawing",
    order: 40,
    summary: "Bring compact SVG path data straight into a Canvas composition.",
    api: ["svgPath"],
    objectives: [
      "Render an SVG `d` string without an SVG element.",
      "Style the resulting shape with Canvas fill and stroke properties.",
    ],
    prompts: {
      gesture: "Click the coral heart for a tiny color pulse.",
      code: "Replace the heart path with another SVG path and adjust its group transform.",
    },
    apiNotes: [
      "Path data is parsed by the browser’s `Path2D` implementation.",
      "Use a group when imported path coordinates need translation or scale.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["path", "group"],
    load: () => import("./learning/drawing/svg-path.example"),
  },
  {
    slug: "line",
    title: "Line",
    shortTitle: "Line",
    section: "drawing",
    order: 50,
    summary:
      "Connect a sequence of coordinates into expressive polylines and diagrams.",
    api: ["line"],
    objectives: [
      "Draw a multi-segment line from coordinate pairs.",
      "Separate visible stroke width from a forgiving mouse hit width.",
    ],
    prompts: {
      gesture: "Trace the cobalt route with the mouse.",
      code: "Move one coordinate to turn the zigzag into a rising chart.",
    },
    apiNotes: [
      "Coordinates are visited in array order.",
      "`lineInteractionWidth` can make a thin line easier to target without changing its paint.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["horizontal-line", "vertical-line", "hit-areas-and-cursors"],
    load: () => import("./learning/drawing/line.example"),
  },
  {
    slug: "horizontal-line",
    title: "Horizontal line",
    shortTitle: "Horizontal line",
    section: "drawing",
    order: 60,
    summary:
      "Place crisp horizontal rules without repeating endpoint coordinates.",
    api: ["horizontalLine"],
    objectives: [
      "Draw a rule from left to right.",
      "Align narrow strokes to the Canvas pixel grid.",
    ],
    prompts: {
      gesture: "Sweep across the three colored rules.",
      code: "Change the middle rule’s left and right bounds to make it a short dash.",
    },
    apiNotes: [
      "Omitted bounds extend to the Canvas edges.",
      "Pixel alignment is opt-in and supports `none`, `round`, `ceil`, and `floor`.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["line", "vertical-line"],
    load: () => import("./learning/drawing/horizontal-line.example"),
  },
  {
    slug: "vertical-line",
    title: "Vertical line",
    shortTitle: "Vertical line",
    section: "drawing",
    order: 70,
    summary: "Build dividers, ticks, and rhythm with a one-axis line helper.",
    api: ["verticalLine"],
    objectives: [
      "Draw a rule from top to bottom.",
      "Use optional bounds and pixel-grid alignment.",
    ],
    prompts: {
      gesture: "Move through the striped field and find each target.",
      code: "Turn the tall coral divider into a short centered tick.",
    },
    apiNotes: [
      "Omitted `top` or `bottom` values use the Canvas bounds.",
      "Event props and cursor styling work the same way as on `line`.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["line", "horizontal-line"],
    load: () => import("./learning/drawing/vertical-line.example"),
  },
  {
    slug: "text",
    title: "Text",
    shortTitle: "Text",
    section: "drawing",
    order: 80,
    summary:
      "Set type directly on Canvas with wrapping, alignment, clipping, and overflow choices.",
    api: ["text"],
    objectives: [
      "Control font, alignment, baseline, and paint.",
      "Constrain copy with width, height, wrapping, and overflow.",
    ],
    prompts: {
      gesture: "Click the headline to cycle its accent.",
      code: "Change the body copy and compare `ellipsis` with `clip`.",
    },
    apiNotes: [
      "Fonts follow the Canvas `font` shorthand.",
      "Wrapped text uses `lineHeight`; constrained overflow can be visible, squished, ellipsized, or clipped.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["getting-started", "image"],
    load: () => import("./learning/drawing/text.example"),
  },
  {
    slug: "image",
    title: "Image",
    shortTitle: "Image",
    section: "drawing",
    order: 90,
    summary:
      "Load an image source into the scene and frame it with intentional geometry.",
    api: ["img"],
    objectives: [
      "Render an image from a URL or data URL.",
      "Choose explicit dimensions, alpha, border, and interaction props.",
    ],
    prompts: {
      gesture: "Click the postcard after it appears.",
      code: "Change its width, height, or alpha to make a faded thumbnail.",
    },
    apiNotes: [
      "Image loading is asynchronous and stale source callbacks are discarded.",
      "Explicit dimensions make layout stable before the image finishes loading.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["text", "layer"],
    load: () => import("./learning/drawing/image.example"),
  },
  {
    slug: "group",
    title: "Group",
    shortTitle: "Group",
    section: "composition",
    order: 100,
    summary: "Move, rotate, scale, or skew related marks as one visual unit.",
    api: ["g"],
    objectives: [
      "Apply one transform to a set of children.",
      "Understand transform order and rotation origins.",
    ],
    prompts: {
      gesture: "Click the rotated ticket.",
      code: "Change `rotate` to `-12` or double both scale values.",
    },
    apiNotes: [
      "Groups affect drawing and hit testing together.",
      "Transforms are composed in scale, rotation, translation, then skew order.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["svg-path", "clip", "transformed-clipped-layered-targets"],
    load: () => import("./learning/composition/group.example"),
  },
  {
    slug: "clip",
    title: "Clip",
    shortTitle: "Clip",
    section: "composition",
    order: 110,
    summary:
      "Crop children to a reusable path while keeping interaction geometry honest.",
    api: ["clip"],
    objectives: [
      "Limit a group of children to a Path2D boundary.",
      "Use nonzero or even-odd fill rules for cutouts.",
    ],
    prompts: {
      gesture:
        "Move around the circular window, including its cropped corners.",
      code: "Shrink the window radius or switch the compound path to `evenodd`.",
    },
    apiNotes: [
      "Nested clips intersect, matching Canvas clipping behavior.",
      "Paint and mouse targeting are both constrained by active clips.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["group", "layer", "transformed-clipped-layered-targets"],
    load: () => import("./learning/composition/clip.example"),
  },
  {
    slug: "layer",
    title: "Layer",
    shortTitle: "Layer",
    section: "composition",
    order: 120,
    summary:
      "Render a subtree on an offscreen Canvas, then compose it into the main scene.",
    api: ["layer"],
    objectives: [
      "Cache a component subtree in an offscreen layer.",
      "Control layer dimensions and preserve child interaction.",
    ],
    prompts: {
      gesture: "Click the mint badge rendered inside the layer.",
      code: "Change the layer size and move the badge within its bounds.",
    },
    apiNotes: [
      "A layer receives one component element through `render`.",
      "Layer children still participate in the root scene’s global paint and target order.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["group", "clip", "overlap-and-paint-order"],
    load: () => import("./learning/composition/layer.example"),
  },
  {
    slug: "click",
    title: "Click",
    shortTitle: "Click",
    section: "mouse-events",
    order: 130,
    summary:
      "Turn a painted region into a button-like target with immediate visual feedback.",
    api: ["onClick"],
    objectives: [
      "Attach an `onClick` handler to painted geometry.",
      "Use CRC state to redraw after activation.",
    ],
    prompts: {
      gesture: "Click each record sleeve to count your picks.",
      code: "Make the counter increase by 10 or change the active color.",
    },
    apiNotes: [
      "A click resolves to one topmost live target.",
      "CRC is currently mouse-only; Canvas regions do not gain native button semantics.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["mouse-down", "mouse-up", "overlap-and-paint-order"],
    load: () => import("./learning/mouse-events/click.example"),
  },
  {
    slug: "double-click",
    title: "Double click",
    shortTitle: "Double click",
    section: "mouse-events",
    order: 140,
    summary:
      "Respond to a deliberate double activation without making it the only route to essential behavior.",
    api: ["onDblClick"],
    objectives: [
      "Attach an `onDblClick` handler.",
      "Design secondary feedback that does not replace a primary click action.",
    ],
    prompts: {
      gesture: "Double-click the yellow tile to stamp it.",
      code: "Change the stamped word or add a normal click color change too.",
    },
    apiNotes: [
      "Double-click timing is supplied by the browser.",
      "Avoid requiring double click for essential web interactions.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["click", "event-sequences"],
    load: () => import("./learning/mouse-events/double-click.example"),
  },
  {
    slug: "context-menu",
    title: "Context menu",
    shortTitle: "Context menu",
    section: "mouse-events",
    order: 150,
    summary:
      "Observe right-click targeting and decide explicitly whether to keep the browser menu.",
    api: ["onContextMenu"],
    objectives: [
      "Handle a context-menu event on a region.",
      "Access the original browser event when default behavior must be controlled.",
    ],
    prompts: {
      gesture: "Right-click the coral card to reveal its in-canvas note.",
      code: "Remove `preventDefault()` to restore the browser context menu.",
    },
    apiNotes: [
      "Use `event.originalEvent.preventDefault()` only when a real alternative is provided.",
      "Context-menu ordering varies by browser and operating system.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["mouse-down", "mouse-up", "event-sequences"],
    load: () => import("./learning/mouse-events/context-menu.example"),
  },
  {
    slug: "mouse-move",
    title: "Mouse move",
    shortTitle: "Mouse move",
    section: "mouse-events",
    order: 160,
    summary:
      "Read intrinsic Canvas coordinates continuously while the mouse travels through a target.",
    api: ["onMouseMove"],
    objectives: [
      "Handle movement over painted geometry.",
      "Use CRC’s intrinsic `x` and `y` coordinates regardless of CSS scaling.",
    ],
    prompts: {
      gesture: "Paint a trail through the cobalt field.",
      code: "Round the coordinates to a 20-pixel grid before drawing the marker.",
    },
    apiNotes: [
      "Movement targets the current topmost region.",
      "Coordinates are expressed in the Canvas intrinsic coordinate system.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["mouse-over", "mouse-out", "event-sequences"],
    load: () => import("./learning/mouse-events/mouse-move.example"),
  },
  {
    slug: "mouse-over",
    title: "Mouse over",
    shortTitle: "Mouse over",
    section: "mouse-events",
    order: 170,
    summary:
      "React once when the logical target changes from elsewhere into a region.",
    api: ["onMouseOver"],
    objectives: [
      "Distinguish target entry from continuous movement.",
      "Use hover state to reveal nonessential visual detail.",
    ],
    prompts: {
      gesture: "Enter each gallery label from the cream background.",
      code: "Reveal a different subtitle or color on entry.",
    },
    apiNotes: [
      "CRC emits logical out/over transitions before movement.",
      "Hover content should remain nonessential because touch has no hover.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["mouse-out", "mouse-move", "event-sequences"],
    load: () => import("./learning/mouse-events/mouse-over.example"),
  },
  {
    slug: "mouse-out",
    title: "Mouse out",
    shortTitle: "Mouse out",
    section: "mouse-events",
    order: 180,
    summary:
      "Reset transient region state as the logical target changes or the Canvas is left.",
    api: ["onMouseOut"],
    objectives: [
      "Handle logical target exit.",
      "Pair over and out handlers for reversible hover feedback.",
    ],
    prompts: {
      gesture: "Enter and leave the mint portal several times.",
      code: "Keep a departure count instead of just toggling the message.",
    },
    apiNotes: [
      "Out fires when another logical region wins or the root Canvas is exited.",
      "Logical related targets are not exposed in the public event type.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["mouse-over", "mouse-move", "event-sequences"],
    load: () => import("./learning/mouse-events/mouse-out.example"),
  },
  {
    slug: "mouse-down",
    title: "Mouse down",
    shortTitle: "Mouse down",
    section: "mouse-events",
    order: 190,
    summary:
      "Show immediate pressed feedback when a mouse button goes down on a target.",
    api: ["onMouseDown"],
    objectives: [
      "Handle the press phase directly.",
      "Keep press feedback separate from completed click activation.",
    ],
    prompts: {
      gesture: "Press and hold the cobalt pad, then release outside it.",
      code: "Use `originalEvent.button` to show which mouse button was pressed.",
    },
    apiNotes: [
      "Mouse down acknowledges a press; it does not mean activation completed.",
      "Pair with mouse up or click when designing a complete gesture.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["mouse-up", "click", "event-sequences"],
    load: () => import("./learning/mouse-events/mouse-down.example"),
  },
  {
    slug: "mouse-up",
    title: "Mouse up",
    shortTitle: "Mouse up",
    section: "mouse-events",
    order: 200,
    summary:
      "Observe release over a region independently from where the press began.",
    api: ["onMouseUp"],
    objectives: [
      "Handle the release phase on the resolved target.",
      "Avoid treating every release as a click.",
    ],
    prompts: {
      gesture:
        "Press on the cream background and release over the yellow target.",
      code: "Show the release coordinates beside the count.",
    },
    apiNotes: [
      "Mouse up targets the region under the release point.",
      "Click activation separately requires compatible live press/release/click targeting.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["mouse-down", "click", "event-sequences"],
    load: () => import("./learning/mouse-events/mouse-up.example"),
  },
  {
    slug: "event-sequences",
    title: "Event sequences",
    shortTitle: "Event sequences",
    section: "advanced-interactions",
    order: 210,
    summary:
      "Watch CRC’s logical target transitions and activation phases arrive in a stable order.",
    api: [
      "onMouseOut",
      "onMouseOver",
      "onMouseMove",
      "onMouseDown",
      "onMouseUp",
      "onClick",
    ],
    objectives: [
      "Inspect transition-before-move ordering.",
      "Separate target changes, press/release, and click activation.",
    ],
    prompts: {
      gesture: "Move from A to B, then press, leave, return, and release.",
      code: "Filter the trace to show only transitions or activation events.",
    },
    apiNotes: [
      "CRC resolves one topmost logical target for each event.",
      "Handlers do not bubble through a synthetic DOM ancestry.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["mouse-over", "mouse-out", "overlap-and-paint-order"],
    load: () =>
      import("./learning/advanced-interactions/event-sequences.example"),
  },
  {
    slug: "hit-areas-and-cursors",
    title: "Hit areas and cursors",
    shortTitle: "Hit areas & cursors",
    section: "advanced-interactions",
    order: 220,
    summary:
      "Make precise art comfortable to target without changing what is painted.",
    api: ["lineInteractionWidth", "cursor"],
    objectives: [
      "Widen a line’s invisible interaction geometry.",
      "Use cursor feedback that follows the winning target.",
    ],
    prompts: {
      gesture:
        "Approach the thin coral path from above until the cursor changes.",
      code: "Compare interaction widths of 8, 24, and 60 pixels.",
    },
    apiNotes: [
      "Interaction width affects targeting, not visible stroke width.",
      "The cursor is owned and cleared with the same region lifecycle.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["line", "overlap-and-paint-order"],
    load: () =>
      import("./learning/advanced-interactions/hit-areas-and-cursors.example"),
  },
  {
    slug: "overlap-and-paint-order",
    title: "Overlap and paint order",
    shortTitle: "Overlap & paint order",
    section: "advanced-interactions",
    order: 230,
    summary:
      "See why the last visible mark under the pointer becomes the one logical target.",
    api: ["rect", "onClick"],
    objectives: [
      "Predict target selection from global paint order.",
      "Reorder elements to change both appearance and interaction.",
    ],
    prompts: {
      gesture: "Click each exclusive color and the shared overlap.",
      code: "Swap the two rectangles in the returned array and retest the overlap.",
    },
    apiNotes: [
      "CRC scans visible paint entries in reverse order and stops at the first hit.",
      "Layers participate in the same global order as root marks.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["click", "layer", "transformed-clipped-layered-targets"],
    load: () =>
      import("./learning/advanced-interactions/overlap-and-paint-order.example"),
  },
  {
    slug: "transformed-clipped-layered-targets",
    title: "Transformed, clipped, and layered targets",
    shortTitle: "Composed targets",
    section: "advanced-interactions",
    order: 240,
    summary:
      "Combine transforms, clips, and offscreen layers while keeping visible paint and mouse targeting aligned.",
    api: ["g", "clip", "layer", "onClick"],
    objectives: [
      "Compose interaction geometry through transforms and clip stacks.",
      "Understand how nested layer targets map back to the root Canvas.",
    ],
    prompts: {
      gesture: "Click the visible mint moon, then try its clipped-away corner.",
      code: "Rotate the group or tighten the circular clip and compare the target.",
    },
    apiNotes: [
      "Target geometry carries accumulated transforms and every active clip.",
      "Layer bounds crop both pixels and interaction before mapping to the root.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["group", "clip", "layer"],
    load: () =>
      import("./learning/advanced-interactions/transformed-clipped-layered-targets.example"),
  },
] as const satisfies readonly LearningDraft[];

function validateText(value: string, field: string, slug: string): void {
  if (!value.trim())
    throw new Error(`Learning example "${slug}" has an empty ${field}.`);
}

export function validateLearningExampleCatalog(
  catalog: readonly LearningExampleCatalogEntry[],
): readonly LearningExampleCatalogEntry[] {
  const slugs = new Set<string>();
  const orders = new Set<number>();
  const paths = new Set<string>();
  const sectionIds = new Set(learningSections.map((section) => section.id));

  for (const entry of catalog) {
    validateText(entry.slug, "slug", entry.slug || "<unknown>");
    validateText(entry.title, "title", entry.slug);
    validateText(entry.summary, "summary", entry.slug);
    if (!SLUG_PATTERN.test(entry.slug) || slugs.has(entry.slug)) {
      throw new Error(
        `Learning example "${entry.slug}" has an invalid or duplicate slug.`,
      );
    }
    if (!sectionIds.has(entry.section)) {
      throw new Error(
        `Learning example "${entry.slug}" has an unknown section.`,
      );
    }
    if (
      !Number.isInteger(entry.order) ||
      entry.order < 1 ||
      orders.has(entry.order)
    ) {
      throw new Error(
        `Learning example "${entry.slug}" has an invalid or duplicate order.`,
      );
    }
    if (
      paths.has(entry.source.path) ||
      entry.source.path !== sourcePath(entry.section, entry.slug)
    ) {
      throw new Error(
        `Learning example "${entry.slug}" has an invalid or duplicate source path.`,
      );
    }
    if (
      entry.objectives.length !== 2 ||
      !entry.api.length ||
      !entry.apiNotes.length
    ) {
      throw new Error(
        `Learning example "${entry.slug}" has incomplete teaching metadata.`,
      );
    }
    if (entry.canvas.width <= 0 || entry.canvas.height <= 0) {
      throw new Error(
        `Learning example "${entry.slug}" has invalid Canvas dimensions.`,
      );
    }
    slugs.add(entry.slug);
    orders.add(entry.order);
    paths.add(entry.source.path);
  }

  for (const entry of catalog) {
    const relationships = [
      entry.relationships.previous,
      entry.relationships.next,
      ...entry.relationships.related,
    ];
    for (const slug of relationships) {
      if (slug && !slugs.has(slug)) {
        throw new Error(
          `Learning example "${entry.slug}" references unknown lesson "${slug}".`,
        );
      }
    }
  }
  return catalog;
}

const orderedDrafts = [...drafts].sort(
  (left, right) => left.order - right.order,
);

export const learningExampleCatalog = validateLearningExampleCatalog(
  orderedDrafts.map((draft, index): LearningExampleCatalogEntry => ({
    ...draft,
    source: { path: sourcePath(draft.section, draft.slug) },
    relationships: {
      previous: orderedDrafts[index - 1]?.slug,
      next: orderedDrafts[index + 1]?.slug,
      related: draft.related ?? [],
    },
    load: async () => (await draft.load()) as never,
  })),
);

export function getLearningExampleBySlug(
  slug: string,
): LearningExampleCatalogEntry | undefined {
  return learningExampleCatalog.find((entry) => entry.slug === slug);
}

export function getLearningExampleRoute(
  entry: LearningExampleMetadata,
): string {
  return `#/examples/${entry.section}/${entry.slug}`;
}

export function getLearningExamplesBySection(
  section: LearningSectionId,
): readonly LearningExampleCatalogEntry[] {
  return learningExampleCatalog.filter((entry) => entry.section === section);
}

export async function loadLearningExample(entry: LearningExampleCatalogEntry) {
  const module = await entry.load();
  if (typeof module.default !== "function") {
    throw new Error(
      `Learning example "${entry.slug}" has no default mount function.`,
    );
  }
  return module;
}
