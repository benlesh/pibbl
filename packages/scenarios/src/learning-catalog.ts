import type {
  LearningExampleCatalogEntry,
  LearningExampleMetadata,
  LearningBrowseGroup,
  LearningSection,
  LearningSectionId,
} from "./learning-types";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const introductionRoutes = {
  "getting-started": "#/learn/guides/configure-jsx",
  "create-element-authoring": "#/learn/guides/author-without-jsx",
  signals: "#/examples/start/signals",
} as const;

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
    description:
      "Build pictures with descriptive primitives and explicit local style objects.",
    order: 2,
  },
  {
    id: "composition",
    label: "Composition",
    description:
      "Pass normal children through groups, clips, and offscreen layers.",
    order: 3,
  },
  {
    id: "layout",
    label: "Layout",
    description:
      "Arrange declared boxes and distinguish specified style from useLayoutBox allocation.",
    order: 4,
  },
  {
    id: "mouse-events",
    label: "Mouse events",
    description: "Give painted regions visible mouse feedback.",
    order: 5,
  },
  {
    id: "user-events",
    label: "User events",
    description:
      "Handle pointer, touch, wheel, propagation, custom targets, and drag/drop.",
    order: 6,
  },
  {
    id: "keyboard-focus",
    label: "Keyboard and focus",
    description:
      "Add logical focus and navigation while the Canvas remains the only native focus host.",
    order: 7,
  },
  {
    id: "advanced-interactions",
    label: "Advanced interactions",
    description: "Reason about ordering, hit geometry, and composed targets.",
    order: 8,
  },
  {
    id: "three",
    label: "Three.js",
    description:
      "Use ordinary Three.js scenes inside CRC composition and interaction.",
    order: 9,
  },
] as const satisfies readonly LearningSection[];

interface LearningDraft extends Omit<
  LearningExampleMetadata,
  "authoring" | "relationships" | "source"
> {
  authoring?: "jsx" | "createElement";
  related?: readonly string[];
  load: () => Promise<unknown>;
}

function sourcePath(section: LearningSectionId, slug: string): string {
  return `packages/scenarios/src/learning/${section}/${slug}.example.tsx`;
}

function isLearningSourcePath(
  path: string,
  section: LearningSectionId,
  slug: string,
): boolean {
  return path === sourcePath(section, slug);
}

function browseGroupFor(
  section: LearningSectionId,
  slug: string,
): LearningBrowseGroup | undefined {
  if (section === "start") return undefined;
  if (section === "drawing" || slug === "filters") return "drawing";
  if (section === "composition") return "composition";
  if (section === "three") return "three";
  if (section === "layout") return "layout";
  if (
    section === "mouse-events" ||
    section === "user-events" ||
    section === "advanced-interactions"
  ) {
    return "events-and-interaction";
  }
  return "focus-and-keyboard";
}

const drafts = [
  {
    slug: "material-lab", title: "Material Lab", shortTitle: "Material Lab", section: "composition", order: 206,
    summary: "Explore seeded marble, paper, and cellular surfaces as backgrounds and repeating fills.", api: ["ProceduralTexture", "Group", "useSignal"],
    objectives: ["Reuse procedural texture output in Canvas composition.", "Keep texture generation independent of display size."],
    prompts: { gesture: "Switch materials, cycle the palette, and make a new variation.", code: "Change the seed to reproduce a material or customize the rendering callback." },
    apiNotes: ["Uses the optional @crc/textures package and the public render-layer lifecycle.", "Texture renderer sources are borrowed for the synchronous callback; CRC owns presentation."],
    canvas: { width: 880, height: 630 }, related: ["living-ink"],
    load: () => import("./learning/composition/material-lab.example"),
  },
  {
    slug: "growing-reveal", title: "Growing Reveal", shortTitle: "Growing Reveal", section: "composition", order: 207,
    summary: "Paint a living alpha mask that reveals illustrated landscapes and colorful typography.", api: ["ReactionDiffusion", "defineRenderLayer", "Group", "useSignal"],
    objectives: ["Reuse procedural texture output in Canvas composition.", "Keep texture generation independent of display size."],
    prompts: { gesture: "Paint the artwork, pause the mask, and switch between landscape and typography.", code: "Use texture.mask with destination-in to reveal your own Canvas artwork." },
    apiNotes: ["Uses the optional @crc/textures package and the public render-layer lifecycle.", "Texture renderer sources are borrowed for the synchronous callback; CRC owns presentation."],
    canvas: { width: 880, height: 630 }, related: ["living-ink"],
    load: () => import("./learning/composition/growing-reveal.example"),
  },

  {
    slug: "living-ink", title: "Living Ink", shortTitle: "Living Ink", section: "composition", order: 205,
    summary: "Paint an evolving reaction-diffusion background with seeded spots, stripes, and live palettes.",
    api: ["ReactionDiffusion", "Group", "useSignal"],
    objectives: ["Paint into a persistent scheduled texture.", "Compose ordinary CRC content over a living background."],
    prompts: { gesture: "Draw on the ink, pause it, and cycle the palette.", code: "Change resolution independently from the displayed size." },
    apiNotes: ["ReactionDiffusion comes from the optional @crc/textures package.", "Reset repeats the seed; New seed creates another variation."],
    canvas: { width: 880, height: 630 }, related: ["layer", "three-layer"],
    load: () => import("./learning/composition/living-ink.example"),
  },
  {
    slug: "getting-started",
    title: "Getting started",
    shortTitle: "Getting started",
    section: "start",
    order: 10,
    summary:
      "Mount a tiny poster, then see how CRC turns component functions into one disposable Canvas scene.",
    api: ["crc", "Rectangle", "Text"],
    objectives: [
      "Write an ordinary named function that returns descriptive CRC JSX.",
      "Add stateful click feedback, then mount the component with crc and retain its controller for cleanup.",
    ],
    prompts: {
      gesture: "Click the cobalt card to change its message.",
      code: "Change the card color or replace “HELLO” with your own title.",
    },
    apiNotes: [
      "A CRC component is a plain synchronous function; no wrapper or registration call is required.",
      "`crc` owns one Canvas mount and returns an idempotent controller with `dispose()`.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["rectangle", "text", "click"],
    load: () => import("./learning/start/getting-started.example"),
  },
  {
    slug: "viz-band-bars", title: "Comparing state population changes", shortTitle: "Band scales and bars",
    section: "composition", order: 195,
    summary: "Compare annual population gains and losses in the six largest U.S. states using Census estimates.",
    api: ["Scale", "useScale", "BarSeries", "Axis"],
    objectives: ["Map ordered categories into local bands.", "Inspect signed bars through ordinary CRC events."],
    prompts: { gesture: "Switch orientation, hover or tap for exact counts, reverse order, change spacing, and resize.", code: "Change the explicit category domain or supply a different baseline." },
    apiNotes: ["Source: U.S. Census Bureau, Vintage 2023 estimates. July 2022–July 2023 change in the six most populous states. Historical snapshot; later vintages may revise these estimates. https://www.census.gov/newsroom/press-releases/2023/population-trends-return-to-pre-pandemic-norms.html", "Unknown or missing categories and missing values skip bars. See grouped bars for nested scales. Semantic category/value props work in either orientation. Callers choose scale ranges and axis placement; valueStart/valueEnd support stacked bars."],
    canvas: { width: 940, height: 660 }, related: ["viz-responsive-line", "viz-points-and-inspection"],
    load: () => import("./learning/composition/viz-band-bars.example"),
  },
  {
    slug: "viz-grouped-stacked-bars", title: "Comparing regional cash flow", shortTitle: "Grouped stacked bars",
    section: "composition", order: 192,
    summary: "Compose separate positive and negative stacks within nested regional bands.",
    api: ["Scale", "useScale", "BarSeries", "Axis"],
    objectives: ["Combine nested band scales with explicit stack endpoints.", "Keep inspection and group identity across orientations."],
    prompts: { gesture: "Toggle orientation, then hover or tap a segment for its region and component.", code: "Change regional values or the pure stack transform." },
    apiNotes: ["Illustrative quarterly operating cash flow in thousands of dollars; not reported financial results.", "Color identifies each component. North precedes South within every quarter; positive and negative stacks accumulate separately for each region."],
    canvas: { width: 940, height: 660 }, related: ["viz-stacked-bars", "viz-grouped-bars", "viz-band-bars"],
    load: () => import("./learning/composition/viz-grouped-stacked-bars.example"),
  },
  {
    slug: "viz-stacked-bars", title: "Stacking cash inflows and outflows", shortTitle: "Stacked bars",
    section: "composition", order: 193,
    summary: "Compose signed stacks from range endpoints using one BarSeries.",
    api: ["Scale", "useScale", "BarSeries", "Axis"],
    objectives: ["Derive stack endpoints with a pure data transform.", "Inspect individual segments with ordinary CRC events."],
    prompts: { gesture: "Hover or tap segments, reverse the stack, hide costs, and resize.", code: "Change the data transform or supply your own start/end values." },
    apiNotes: ["Illustrative quarterly business data in thousands of dollars; not reported financial results.", "Positive and negative values accumulate separately from zero. Stacking is data preparation; BarSeries renders the supplied ranges."],
    canvas: { width: 940, height: 720 }, related: ["viz-grouped-bars", "viz-band-bars"],
    load: () => import("./learning/composition/viz-stacked-bars.example"),
  },
  {
    slug: "viz-grouped-bars", title: "Comparing populations across years", shortTitle: "Grouped bars",
    section: "composition", order: 194,
    summary: "Compare state populations with two or three adjacent bars per category.",
    api: ["Scale", "useScale", "BarSeries", "Axis"],
    objectives: ["Nest a band scale inside each category bandwidth.", "Style groups within one BarSeries."],
    prompts: { gesture: "Hover or tap bars; add a third year, reverse years, and resize.", code: "Change the inner domain to select and order groups." },
    apiNotes: ["Source: Census Bureau Vintage 2023, Table 1. 2020 is the April 1 estimates base; 2022 and 2023 are July 1 estimates. Historical snapshot. https://www.census.gov/newsroom/press-releases/2023/population-trends-return-to-pre-pandemic-norms.html", "Each group has an explicit slot. A missing row leaves that slot empty."],
    canvas: { width: 940, height: 660 }, related: ["viz-band-bars", "viz-responsive-line"],
    load: () => import("./learning/composition/viz-grouped-bars.example"),
  },
  {
    slug: "viz-pie-composition", title: "Compose an interactive pie", shortTitle: "Pie composition",
    section: "composition", order: 196,
    summary: "Compose pie and donut slices with coordinated labels, legends, and readouts.",
    api: ["PieLayout", "PieSlice", "PieLabel", "pieSlices", "HoverCard"],
    objectives: ["Reuse pure slice geometry.", "Inspect category-keyed wedges through ordinary CRC events."],
    prompts: { gesture: "Toggle the donut, compare inside and automatic labels, click to pin, then reverse the slices.", code: "Change the values or compose your own labels from slice angles." },
    apiNotes: ["Illustrative data: 100 fictional transport survey responses.", "Angles follow Canvas conventions; stable category keys survive reorder."],
    canvas: { width: 1000, height: 570 }, related: ["viz-points-and-inspection", "signals"],
    load: () => import("./learning/composition/viz-pie-composition.example"),
  },
  {
    slug: "viz-hover-comparison",
    title: "Comparing two lines at a shared time",
    shortTitle: "Hover comparisons",
    section: "composition",
    order: 197,
    summary:
      "Compare recorded and interpolated NOAA CO₂ values with ordinary function queries and protected hover cards.",
    api: [
      "HoverData",
      "AnchoredLayout",
      "closestPoint",
      "closestX",
      "interpolateX",
      "defineSeries",
      "linearInterpolation",
    ],
    objectives: [
      "Compose one or multiple query results.",
      "Distinguish recorded observations from interpolated estimates.",
    ],
    prompts: {
      gesture: "Switch modes, then move or drag the inspection guide.",
      code: "Replace the composed query with your own synchronous function.",
    },
    apiNotes: [
      "Data: NOAA/GML and Scripps, Mauna Loa monthly mean and deseasonalized CO₂, 2020–2021. https://gml.noaa.gov/ccgg/trends/data.html",
      "Interpolation estimates in data space; missing values break segments.",
    ],
    canvas: { width: 1000, height: 620 },
    related: ["viz-points-and-inspection", "viz-responsive-line"],
    load: () => import("./learning/composition/viz-hover-comparison.example"),
  },
  {
    slug: "viz-points-and-inspection",
    title: "Exploring Palmer penguin measurements",
    shortTitle: "Penguin measurements",
    section: "composition",
    order: 198,
    summary:
      "Explore 344 real Palmer penguin records with batched dots, custom keyed marks, and linked inspection.",
    api: [
      "PointSeries",
      "PlotSeries",
      "nearestPoint",
      "Scale",
      "Axis",
      "HoverData",
      "HoverCard",
    ],
    objectives: [
      "Compose batched dots and custom CRC subtrees.",
      "Inspect mapped anchors and preserve custom mark state on reorder.",
    ],
    prompts: {
      gesture:
        "Hover or tap a point, click custom squares, then reorder and resize.",
      code: "Replace the custom square with your own CRC elements.",
    },
    apiNotes: [
      "Custom marks draw around the mapped local origin.",
      "PointSeries batches circles; PlotSeries preserves normal per-row component state.",
      "Source: palmerpenguins (Horst, Hill & Gorman), collected by Kristen Gorman / Palmer Station LTER, 2007–2009, CC0. Both plots show flipper length (mm) versus body mass (g); two incomplete records remain missing. https://allisonhorst.github.io/palmerpenguins/",
    ],
    canvas: { width: 1100, height: 680 },
    related: ["viz-responsive-line", "signals"],
    load: () =>
      import("./learning/composition/viz-points-and-inspection.example"),
  },
  {
    slug: "viz-responsive-line",
    title: "Exploring the Mauna Loa CO₂ record",
    shortTitle: "CO₂ explorer",
    section: "composition",
    order: 199,
    summary:
      "Explore 504 real monthly NOAA observations with a decade view, archive navigator, and linked readouts.",
    api: ["Scale", "Axis", "LineSeries", "ScaleAdjust", "useScale", "Absolute"],
    objectives: [
      "Bind scales to local layout allocations.",
      "Explore a static dataset through ordinary pointer events and signal-valued domains.",
    ],
    prompts: {
      gesture:
        "Hover to read a month, click to pin it, then drag the overview selection or its edges to explore a date range.",
      code: "Change the initial date window or the two line styles.",
    },
    apiNotes: [
      "Scales use their local allocation, not a global chart rectangle.",
      "Source: NOAA GML / Scripps monthly Mauna Loa CO₂, Jan 1980–Dec 2021. April 1984 is interpolated in the source record.",
    ],
    canvas: { width: 1100, height: 680 },
    related: ["grid", "signals"],
    load: () => import("./learning/composition/viz-responsive-line.example"),
  },
  {
    slug: "create-element-authoring",
    title: "Authoring without JSX",
    shortTitle: "Without JSX",
    section: "start",
    order: 15,
    authoring: "createElement",
    summary:
      "Build a complete interactive CRC tree with createElement, recursive children, focus policies, hooks, and no JSX syntax.",
    api: [
      "createElement",
      "non-jsx",
      "Fragment",
      "Group",
      "Rectangle",
      "Text",
      "FocusManagement",
      "KeyboardNavigation",
      "useSignal",
      "useReaction",
    ],
    objectives: [
      "Use createElement(type, props, ...children) for fragments, keyed dynamic lists, components, and textual zero/state interpolation.",
      "Mount and dispose a non-JSX scene with hook lifecycle, focus management, directional navigation, and keyboard activation.",
    ],
    prompts: {
      gesture:
        "Click choice A, then press ArrowRight and Enter to activate choice B from the keyboard.",
      code: "Add another keyed choice or another dynamic Text child with createElement.",
    },
    apiNotes: [
      "`createElement` is the complete non-JSX alternative and produces the same CRC element protocol as JSX.",
      "Pass dynamic lists as one array child; multiple variadic children remain in source order.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["getting-started", "group", "text"],
    load: () => import("./learning/start/create-element-authoring.example"),
  },
  {
    slug: "manipulation",
    title: "Moving, resizing, and rotating components",
    shortTitle: "Manipulation",
    section: "user-events",
    order: 299,
    summary: "Bind a component box to signals, drag its title, resize its corners, and rotate with modifier snapping.",
    api: ["useManipulation", "ManipulationFrame", "DragHandle", "ResizeHandles", "RotationHandle", "degrees"],
    objectives: ["Manipulate explicit geometry through standard handles.", "Observe nested Flex content reflow as the frame resizes."],
    prompts: { gesture: "Drag the title, a corner, or the rotation handle; Shift snaps and Alt locks resize ratio.", code: "Change the snap steps or minimum width and height." },
    apiNotes: ["Geometry uses one writable signal and normal scheduled rendering.", "The frame needs no Absolute wrapper; its nested layout receives its current allocation."],
    canvas: { width: 800, height: 560 },
    related: ["signals", "flex"],
    load: () => import("./learning/user-events/manipulation.example"),
  },
  {
    slug: "signals",
    title: "Signals",
    shortTitle: "Signals",
    section: "start",
    order: 17,
    summary:
      "Pass writable and computed values directly to CRC inputs so each receiving component owns its dependency.",
    api: ["signal", "computed", "useSignal"],
    objectives: [
      "Pass signals directly into style fields and textual children without manually unwrapping them.",
      "Update writable signals from an event and derive an equality-aware value with computed().",
    ],
    prompts: {
      gesture:
        "Click the blue card to move it and switch its component-local color.",
      code: "Change the x update or derive another label from the shared writable signal.",
    },
    apiNotes: [
      "A CRC-provided receiver resolves a signal at its declared input boundary and owns the resulting dependency.",
      "Calling .get() remains valid when the enclosing component intentionally wants to become the consumer.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["getting-started", "layer", "create-element-authoring"],
    load: () => import("./learning/start/signals.example"),
  },
  {
    slug: "rectangle",
    title: "Rectangle",
    shortTitle: "Rectangle",
    section: "drawing",
    order: 20,
    summary:
      "Use rectangles as bold blocks of color, outlined frames, and precise layout anchors.",
    api: ["Rectangle"],
    objectives: [
      "Declare rectangle geometry and paint inside one explicit style object.",
      "Combine fill, stroke, alpha, and pixel-grid alignment.",
    ],
    prompts: {
      gesture: "Hover the coral block to confirm its target area.",
      code: "Make the yellow square twice as wide and give it a cobalt stroke.",
    },
    apiNotes: [
      "A rectangle can be fill-only, stroke-only, or both.",
      "cornerRadius and cornerRadii round every corner or target individual corners without changing the rectangle's box.",
      "Visual and layout values stay local under `style`; event handlers remain separate props.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["path", "click", "overlap-and-paint-order"],
    load: () => import("./learning/drawing/rectangle.example"),
  },
  {
    slug: "circle",
    title: "Circle",
    shortTitle: "Circle",
    section: "drawing",
    order: 25,
    summary: "Draw a round mark from an explicit center and radius.",
    api: ["Circle"],
    objectives: [
      "Set a circle center, radius, fill, and outline in one local style object.",
      "Use the filled interior as an intentional click target.",
    ],
    prompts: {
      gesture: "Click the coral circle to change its fill.",
      code: "Move the center or make the radius larger to reshape the composition.",
    },
    apiNotes: [
      "Circle radius percentages resolve against the smaller available axis.",
      "Fill geometry is used for clicks while the dark outline remains a stroke.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["ellipse", "wedge", "click"],
    load: () => import("./learning/drawing/circle.example"),
  },
  {
    slug: "ellipse",
    title: "Ellipse",
    shortTitle: "Ellipse",
    section: "drawing",
    order: 35,
    summary:
      "Stretch and rotate a curved mark with independent horizontal and vertical radii.",
    api: ["Ellipse"],
    objectives: [
      "Use radiusX, radiusY, and rotation to define ellipse geometry.",
      "Click the filled ellipse to swap its color without changing its bounds.",
    ],
    prompts: {
      gesture: "Click the blue ellipse to turn it gold.",
      code: "Change rotation or either radius to compare the resulting silhouette.",
    },
    apiNotes: [
      "Ellipse rotation uses radians and is local to the primitive.",
      "The separate radii make an ellipse distinct from a circle.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["circle", "arc", "click"],
    load: () => import("./learning/drawing/ellipse.example"),
  },
  {
    slug: "arc",
    title: "Arc",
    shortTitle: "Arc",
    section: "drawing",
    order: 45,
    summary:
      "Draw a stroke-only curved sweep with explicit start and end angles.",
    api: ["Arc"],
    objectives: [
      "Define an open curved stroke with a radius and radian angles.",
      "Give a narrow painted arc a forgiving interaction width.",
    ],
    prompts: {
      gesture: "Click the top of the blue arc to switch it to coral.",
      code: "Reverse the angles or adjust the radius to trace a different sweep.",
    },
    apiNotes: [
      "Arc is stroke-only; it does not close the curve with a chord.",
      "lineInteractionWidth can make a thin visual stroke easier to target.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["ellipse", "wedge", "line"],
    load: () => import("./learning/drawing/arc.example"),
  },
  {
    slug: "wedge",
    title: "Wedge",
    shortTitle: "Wedge",
    section: "drawing",
    order: 55,
    summary:
      "Close a circular sweep back to its center to make a filled sector.",
    api: ["Wedge"],
    objectives: [
      "Use radius and radian angles to draw a center-closed sector.",
      "Click the sector interior to switch its fill color.",
    ],
    prompts: {
      gesture: "Click inside the violet wedge to turn it green.",
      code: "Widen the angle span or rotate both angles around the center.",
    },
    apiNotes: [
      "Wedge paints an arc plus two radial edges, unlike the open Arc primitive.",
      "A full-circle wedge omits a radial stroke seam.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["arc", "circle", "click"],
    load: () => import("./learning/drawing/wedge.example"),
  },
  {
    slug: "polygon",
    title: "Polygon",
    shortTitle: "Polygon",
    section: "drawing",
    order: 65,
    summary:
      "Close ordered coordinate pairs into a filled, outlined multi-sided mark.",
    api: ["Polygon"],
    objectives: [
      "Connect finite coordinate pairs into a closed polygon.",
      "Use the closed interior as a direct click target.",
    ],
    prompts: {
      gesture: "Click the amber polygon to turn it teal.",
      code: "Move a point or add another side to reshape the closed outline.",
    },
    apiNotes: [
      "Polygon closes the final point back to the first point automatically.",
      "cornerRadius rounds each polygon vertex while keeping the original coordinate extrema.",
      "At least three finite coordinates are required to paint geometry.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["line", "path", "click"],
    load: () => import("./learning/drawing/polygon.example"),
  },
  {
    slug: "regular-polygon",
    title: "Regular polygon",
    shortTitle: "Regular polygon",
    section: "drawing",
    order: 75,
    summary:
      "Generate a regular shape with equal sides and angles from a center and exactly one size mode.",
    api: ["RegularPolygon"],
    objectives: [
      "Choose circumradius, inradius, or sideLength as the one defining size.",
      "Rotate a regular polygon without manually calculating its vertices.",
    ],
    prompts: {
      gesture:
        "Compare the pentagon, hexagon, and square built from the three size modes.",
      code: "Change sides or rotation while keeping exactly one of circumradius, inradius, or sideLength.",
    },
    apiNotes: [
      "RegularPolygon accepts exactly one of circumradius, inradius, or sideLength.",
      "rotation is measured in radians from the default upward first vertex.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["polygon", "star", "clip"],
    load: () => import("./learning/drawing/regular-polygon.example"),
  },
  {
    slug: "star",
    title: "Star",
    shortTitle: "Star",
    section: "drawing",
    order: 85,
    summary:
      "Alternate outer tips and inner valleys to draw a star with selective rounded corners.",
    api: ["Star"],
    objectives: [
      "Set points plus outerRadius and innerRadius to define the alternating vertices.",
      "Round selected tips while preserving sharp valleys with cornerRadii.",
    ],
    prompts: {
      gesture:
        "Compare the five-tip star with the selectively rounded seven-tip star.",
      code: "Change points, radii, or alternating cornerRadii to reshape either star.",
    },
    apiNotes: [
      "A Star requires an integer point count of at least three and outerRadius at least as large as innerRadius.",
      "cornerRadii follows the generated tip-and-valley traversal order.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["regular-polygon", "polygon", "path"],
    load: () => import("./learning/drawing/star.example"),
  },
  {
    slug: "path",
    title: "Path",
    shortTitle: "Path",
    section: "drawing",
    order: 30,
    summary:
      "Draw custom geometry with the browser’s Path2D vocabulary and let CRC paint it.",
    api: ["Path"],
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
    slug: "text-geometry", title: "Editable text outlines", shortTitle: "Text outlines",
    section: "drawing", order: 32,
    summary: "Type text, generate font outlines, and drag their control points.",
    api: ["loadOutlineFont", "createTextGeometry", "PathGeometry", "Path"],
    objectives: ["Shape text with HarfBuzz into editable curves.", "Manipulate glyph outlines without reshaping during dragging."],
    prompts: { gesture: "Type a word, generate its outline, then drag gold or white points.", code: "Change the font size or the starting text." },
    apiNotes: ["Font loading is asynchronous; conversion and point editing are synchronous.", "The font handle is disposed when the example is unmounted."],
    canvas: { width: 900, height: 480 }, related: ["path-geometry", "text"],
    load: () => import("./learning/drawing/text-geometry.example"),
  },
  {
    slug: "path-geometry",
    title: "Path playground",
    shortTitle: "Path geometry",
    section: "drawing",
    order: 31,
    summary: "See anchors and curve controls while flattening, simplifying, and subdividing a path.",
    api: ["PathGeometry", "Path", "flattenPath", "flattenPathWang", "simplifyPath", "simplifyPathRadial", "subdividePath"],
    objectives: ["Compare path operations through the public API.", "See how anchors and control points change while the original remains visible."],
    prompts: {
      gesture: "Drag any point. Try each algorithm, or load the dense preset to compare simplifiers.",
      code: "Change the tolerance, subdivision count, or starting path.",
    },
    apiNotes: [
      "Each operation returns a new PathGeometry; a signal schedules the updated preview.",
      "Simplify accepts lines, so this example flattens curves first. Reset restores the original curves.",
    ],
    canvas: { width: 760, height: 520 },
    related: ["path", "svg-path"],
    load: () => import("./learning/drawing/path-geometry.example"),
  },
  {
    slug: "path-warp",
    title: "Four-corner path warp",
    shortTitle: "Path warp",
    section: "drawing",
    order: 36,
    summary: "Bend a rocket and its flight grid with four draggable corners. Compare bilinear and perspective warps.",
    api: ["PathGeometry", "warpPath", "Path"],
    objectives: ["Deform continuous geometry with four corner handles.", "Keep original geometry independent of derived previews."],
    prompts: {
      gesture: "Drag the mint corners, switch Bilinear / Perspective, and compare the same shape.",
      code: "Change the rocket outline or the destination-space tolerance.",
    },
    apiNotes: [
      "warpPath returns independent line geometry; the original outline is preserved.",
      "Bilinear can fold or bend geometry. Perspective preserves straight lines and needs convex corners.",
    ],
    canvas: { width: 900, height: 580 },
    related: ["path-geometry", "path"],
    load: () => import("./learning/drawing/path-warp.example"),
  },
  {
    slug: "path-bending",
    title: "Along Arc",
    shortTitle: "Along Arc",
    section: "drawing",
    order: 37,
    summary: "Drag the center, radius, and sweep to bend a ribbon around a circular arc.",
    api: ["PathGeometry", "Path", "bendPathAlongArc"],
    objectives: ["Bend complete curves and closing edges along a circular arc.", "Control the baseline and placement of independent geometry."],
    prompts: {
      gesture: "Drag the gold radius, center, and sweep handles. Compare baseline, fitting, and alignment.",
      code: "Change the source outline, the guide curve, or the arc's signed sweep.",
    },
    apiNotes: [
      "Bottom baseline places the source above a rightward guide; top places it below.",
      "The result is independent line geometry with output-space tolerance. Recompute from the original when controls change.",
    ],
    canvas: { width: 800, height: 620 },
    related: ["along-path", "path-geometry", "path"],
    load: () => import("./learning/drawing/path-bending.example"),
  },
  {
    slug: "along-path",
    title: "Along Path",
    shortTitle: "Along Path",
    section: "drawing",
    order: 38,
    summary: "Drag a custom guide curve and watch an entire ribbon bend along it.",
    api: ["PathGeometry", "Path", "bendPathAlongPath"],
    objectives: ["Bend complete curves and closing edges along a supplied path.", "Control the baseline and placement of independent geometry."],
    prompts: {
      gesture: "Drag either gold control handle to reshape the guide and the green ribbon together.",
      code: "Change the source outline or cubic guide, then compare stretch and natural-width fitting.",
    },
    apiNotes: [
      "Bottom baseline places the source above a rightward guide; top places it below.",
      "The result is independent line geometry with output-space tolerance. Recompute from the original when controls change.",
    ],
    canvas: { width: 800, height: 620 },
    related: ["path-bending", "path-geometry", "path"],
    load: () => import("./learning/drawing/along-path.example"),
  },
  {
    slug: "svg-path",
    title: "SVG path",
    shortTitle: "SVG path",
    section: "drawing",
    order: 40,
    summary: "Bring compact SVG path data straight into a Canvas composition.",
    api: ["SvgPath"],
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
    api: ["Line"],
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
    api: ["HorizontalLine"],
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
    api: ["VerticalLine"],
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
      "Event props and cursor styling work the same way as on `Line`.",
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
    api: ["Text"],
    objectives: [
      "Control font, alignment, baseline, and paint.",
      "Provide literal, numeric-zero, and state-interpolated Text children, then constrain copy with width, height, wrapping, and overflow style.",
    ],
    prompts: {
      gesture: "Click the headline to cycle its accent.",
      code: "Change the body copy and compare `ellipsis` with `clip`.",
    },
    apiNotes: [
      "Text concatenates synchronous child content while fonts follow the Canvas `font` shorthand.",
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
    api: ["Image"],
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
    api: ["Group"],
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
      "Group receives normal JSX children in source paint order; transforms compose as scale, rotation, translation, then skew.",
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
    api: ["Clip", "createRegularPolygonPath"],
    objectives: [
      "Memoize a reusable hexagon Path2D with createRegularPolygonPath.",
      "Use an inradius-defined hexagon to clip children and their interaction geometry.",
    ],
    prompts: {
      gesture: "Move across the hexagon window, including its cropped corners.",
      code: "Change the hexagon's inradius or sides, then compare the clipped region.",
    },
    apiNotes: [
      "`useConst` creates the reusable hexagon path once for the mounted component.",
      "`createRegularPolygonPath` uses sides, center coordinates, and exactly one size mode such as inradius.",
      "Nested clips intersect, matching Canvas clipping behavior.",
      "Clip receives children directly, and both paint and targeting are constrained by its active path.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["group", "layer", "transformed-clipped-layered-targets"],
    load: () => import("./learning/composition/clip.example"),
  },
  {
    slug: "underwater",
    title: "Underwater scene",
    shortTitle: "Underwater",
    section: "composition",
    order: 209,
    summary: "Animate a texture-driven displacement filter over a cached scene while preserving click geometry.",
    api: ["Group", "Layer", "Rectangle", "Text", "useTexture", "useSignal"],
    objectives: ["Feed an animated texture into an appearance-only filter.", "Keep scene content in an explicit Layer while waves animate."],
    prompts: {
      gesture: "Pause the water, cycle strength and speed, and click inside the orange outline.",
      code: "Change the wave seed, map tile size, or displacement strength.",
    },
    apiNotes: ["Displacement samples a texture's red and green channels without moving logical targets.", "The same live texture feeds the filter and the map preview.", "WebGL2 and OffscreenCanvas are required for displacement."],
    canvas: { width: 800, height: 540 },
    related: ["optional-filters", "filters", "layer"],
    load: () => import("./learning/composition/underwater.example"),
  },
  {
    slug: "optional-filters",
    title: "Optional filters",
    shortTitle: "Optional filters",
    section: "composition",
    order: 208,
    summary: "Import a blur factory, animate its input, and keep the original click geometry.",
    api: ["Group", "Rectangle", "Text", "CRCFilter", "useSignal"],
    objectives: ["Use an explicitly imported appearance-only filter.", "Observe unchanged target geometry while blur changes."],
    prompts: {
      gesture: "Toggle blur, change its radius, and click inside and just outside the orange outline.",
      code: "Change the blur radius or remove its factory import and filter usage.",
    },
    apiNotes: ["The filter changes pixels only. The orange outline stays aligned with the click target.", "Importing one filter does not require the other effects."],
    canvas: { width: 720, height: 420 },
    related: ["filters", "group", "layer"],
    load: () => import("./learning/composition/optional-filters.example"),
  },
  {
    slug: "filters",
    title: "Filters",
    shortTitle: "Filters",
    section: "composition",
    order: 115,
    summary:
      "Compare every filter, an ordered filter array, and nested filter boundaries in one static gallery.",
    api: ["Group", "Rectangle", "Circle", "Text", "CRCFilter"],
    objectives: [
      "Compare all ten filters against one shared multicolor gradient.",
      "Contrast an ordered filter array with nested boundaries that execute inside out.",
    ],
    prompts: {
      gesture: "Scan all thirteen samples; this lesson needs no interaction.",
      code: "Change the shared gradient or reorder the array and nested filters.",
    },
    apiNotes: [
      "The Group makes one combined silhouette, so its rectangle, circle, and text cast one shared drop shadow rather than separate shadow stacks.",
      "A filter list runs in declaration order: each function receives the pixels produced by the preceding function.",
    ],
    canvas: { width: 960, height: 660 },
    related: ["group", "layer", "transformed-clipped-layered-targets"],
    load: () => import("./learning/composition/filters.example"),
  },
  {
    slug: "three-instancing",
    title: "Three.js instancing",
    shortTitle: "Three instancing",
    section: "three",
    order: 116,
    summary:
      "Compose a procedural Three.js InstancedMesh between CRC tiles and controls while CRC owns scheduling, arbitration, focus, clipping, and filters.",
    api: ["defineThreeLayer", "InstancedMesh", "OrbitControls", "missBehavior"],
    objectives: [
      "Adapt an official Three.js instancing idea into one transparent CRC render-layer paint entry without a second animation loop.",
      "Compare registered targets, unregistered blocking geometry, transparent misses, OrbitControls input, and later CRC paint order.",
    ],
    prompts: {
      gesture:
        "Hover the instance field, click the gold registered icosahedron, drag an empty gap after selecting target-layer, and click the foreground policy control.",
      code: "Change the deterministic lattice colors or cycle the miss policy order while preserving the registered target.",
    },
    apiNotes: [
      "defineThreeLayer owns the WebGLRenderer and commits one transparent bitmap through CRC's public render-layer lifecycle.",
      "Unregistered visible Three geometry blocks lower CRC paint; registered objects participate in ordinary CRC propagation and logical focus.",
      "OrbitControls receives only CRC-winning input and invalidates the shared scheduler instead of starting requestAnimationFrame or setAnimationLoop.",
      "The surrounding CRC Clip and drop-shadow filter apply to the flattened Three bitmap, while the later CRC toolbar wins overlapping input.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["group", "clip", "filters"],
    load: () => import("./learning/three/three-instancing.example"),
  },
  {
    slug: "three-layer",
    title: "Three.js inside CRC",
    shortTitle: "Three layer",
    section: "three",
    order: 117,
    summary:
      "Mount ordinary Three.js objects between Canvas paint and share CRC targeting, focus, filters, and scheduling.",
    api: ["defineThreeLayer", "Scene", "Mesh", "missBehavior"],
    objectives: [
      "Create one reusable Three layer whose scene and renderer survive CRC component updates.",
      "Compare unregistered blocking geometry, a registered CRC target, and transparent pixels that pass through to Canvas.",
    ],
    prompts: {
      gesture:
        "Click the blue shape, the gold shape, and empty space; then Tab to the gold shape and press Enter.",
      code: "Change the Three materials or switch missBehavior from pass-through to block.",
    },
    apiNotes: [
      "defineThreeLayer is declared once at module scope and owns one WebGLRenderer per mounted CRC identity.",
      "Visible unregistered Three geometry blocks lower Canvas targets; registered objects join CRC event propagation and focus.",
      "The drop-shadow filter applies outside the completed transparent Three bitmap.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["three-instancing", "layer", "overlap-and-paint-order"],
    load: () => import("./learning/three/three-layer.example"),
  },
  {
    slug: "signal-inputs",
    title: "Signal inputs",
    shortTitle: "Signal inputs",
    section: "composition",
    order: 118,
    summary:
      "Pass signals directly to geometry, paint, text, and custom data APIs so each receiver owns its dependency.",
    api: [
      "SignalValue",
      "resolveSignalValue",
      "batch",
      "useComputed",
      "useReaction",
    ],
    objectives: [
      "Pass writable signals directly into Rectangle style fields and Text children.",
      "Resolve data and a computed domain in the custom component that consumes them, batch visual updates, and keep external synchronization reaction-only.",
    ],
    prompts: {
      gesture:
        "Click the blue card for one batched visual update, then click Reaction-only update.",
      code: "Pass another SignalValue input into LineSeries and resolve it at that component boundary.",
    },
    apiNotes: [
      "Passing a signal object leaves the read and dependency with the receiving CRC component; passing signal.get() intentionally assigns it to the enclosing component.",
      "resolveSignalValue performs one declared read only. It never searches arbitrary application data for nested signals.",
      "The computed domain is an equality barrier, while the reaction reads a separate signal in Complete and mutates only an external resource.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["signals", "signals-and-animation", "rectangle", "text"],
    load: () => import("./learning/composition/signal-inputs.example"),
  },
  {
    slug: "signals-and-animation",
    title: "Signals and animation",
    shortTitle: "Signals + animation",
    section: "composition",
    order: 119,
    summary:
      "Compose immutable animation definitions into one component-owned program whose committed signal values enter ordinary styles explicitly.",
    api: [
      "useSignal",
      "useTransition",
      "usePlayback",
      "parallel",
      "sequence",
      "marker",
      "spring",
    ],
    objectives: [
      "Bind tween and spring definitions to writable signals, then compose their tracks with parallel, sequence, and a named marker.",
      "Keep playback ownership in one component while every animation advances and commits through CRC's central frame scheduler.",
    ],
    prompts: {
      gesture:
        "Click the blue card or focus it and press Enter to replay the entrance and retarget its scale.",
      code: "Change the entrance duration, marker name, or spring stiffness without changing how style reads resolved values.",
    },
    apiNotes: [
      "Definitions and programs are immutable descriptions; usePlayback supplies the stateful component owner and snapshots an accepted run.",
      "All playbacks advance in shared scheduler phases and publish one central Commit before affected CRC roots render.",
      "Signals can flow directly into declared CRC inputs; the receiving component resolves them and owns the dependency.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["signals", "group", "layer"],
    load: () => import("./learning/composition/signals-and-animation.example"),
  },
  {
    slug: "fire-and-flow",
    title: "Fire and Flow",
    shortTitle: "Fire and Flow",
    section: "composition",
    order: 128,
    summary: "Animated fire and buoyant smoke flowing around shapes you can move, resize, and rotate.",
    api: ["Particles2D", "useParticleSystem", "useFlowField2D", "useFlowSource2D"],
    objectives: ["Share a flow field between smoke particles and solid obstacles.", "Manipulate solid shapes through decorative particles."],
    prompts: { gesture: "Drag a shape, use its resize and rotation handles, then click empty space to deselect.", code: "Change flame noise, source heat, obstacle geometry, or smoke lifetime." },
    apiNotes: ["Flow sources drive velocity and heat independently of particle emission.", "The obstacle source supplies packed committed geometry; particles are not rigid bodies."],
    canvas: { width: 720, height: 480 },
    related: ["particle-effects", "physics-2d"],
    load: () => import("./learning/composition/fire-and-flow.example"),
  },
  {
    slug: "particle-effects",
    title: "Particle effects",
    shortTitle: "Particle effects",
    section: "composition",
    order: 120,
    summary:
      "Drag a burning square while world-space flame and smoke particles keep rising from every place they were emitted.",
    api: [
      "defineParticleEffect2D",
      "particleRange",
      "particleChoice",
      "particleCurve",
      "useParticleSystem",
      "Particles2D",
      "useSignal",
      "usePlayback",
      "repeat",
      "sequence",
      "wait",
      "marker",
    ],
    objectives: [
      "Combine separate flame and smoke emitters with seeded ranges, motion, appearance curves, and rendering modes.",
      "Emit at a draggable square's current root coordinates so living particles remain at their original world-space birth positions.",
    ],
    prompts: {
      gesture:
        "Drag the burning square around the stage and watch its older flame and smoke continue rising behind it.",
      code: "Change the flame cadence, smoke lifetime, or drag bounds while keeping the Particles2D component fixed to the stage.",
    },
    apiNotes: [
      "A Particles2D component owns one fixed-capacity executor; particles are data inside it rather than individual CRC components.",
      "Manual births snapshot the square's root-space position, so moving the signal-driven Rectangle does not translate particles that are already alive.",
      "A repeating animation program supplies scheduler-owned emission markers without creating a second timer or animation loop.",
      "Pointer capture keeps the square attached to the drag even when the pointer moves outside its geometry.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["signals-and-animation", "layer", "pointer-events"],
    load: () => import("./learning/composition/particle-effects.example"),
  },
  {
    slug: "physics-panels",
    title: "Reusable physics panels",
    shortTitle: "Physics panels",
    section: "composition",
    order: 127,
    summary:
      "Move and resize two independent simulations without resetting their bodies or changing their local physics.",
    api: [
      "PhysicsWorld2D",
      "Group",
      "dynamicBody2D",
      "staticBody2D",
      "collider2D",
      "crcPhysicsBody2D",
      "applyImpulse2D",
      "useSignal",
    ],
    objectives: [
      "Reuse one physics component in two independently owned local worlds.",
      "Move and resize a viewport while preserving body identity, velocity and local collision geometry.",
    ],
    prompts: {
      gesture: "Click a ball, then resize or move the panels while it bounces.",
      code: "Add another SimulationPanel or change its outer transform without changing the simulation component.",
    },
    apiNotes: [
      "space=local makes simulation coordinates relative to the PhysicsWorld2D boundary.",
      "Outer transforms change presentation; named commands change physical motion.",
      "Use toPhysicsPoint2D to convert root-logical pointer coordinates before local queries or dragging.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["physics-2d", "group"],
    load: () => import("./learning/composition/physics-panels.example"),
  },
  {
    slug: "physics-2d",
    title: "2D physics",
    shortTitle: "2D physics",
    section: "composition",
    order: 121,
    summary:
      "Drag, throw, and roll a dynamic ball through static bumpers and a collider-only sensor in one scheduler-owned 2D physics world.",
    api: [
      "PhysicsWorld2D",
      "dynamicBody2D",
      "staticBody2D",
      "collider2D",
      "crcPhysicsBody2D",
      "useRef",
      "useSignal",
      "setPointerCapture",
      "disableBody2D",
      "teleportBody2D",
      "enableBody2D",
      "setLinearVelocity2D",
    ],
    objectives: [
      "Attach static and dynamic bodies to ordinary CRC drawing primitives, then add solid bumpers and a collider-only sensor.",
      "Capture one pointer, drag a disabled body with explicit teleports, then hand measured release velocity back to physics.",
    ],
    prompts: {
      gesture:
        "Drag the blue ball above a bumper, then throw it along the ground.",
      code: "Change gravity, damping, bumper restitution, or the drag bounds while leaving the world on CRC's shared scheduler.",
    },
    apiNotes: [
      "An enabled dynamic root pose is physics-owned; named disable, teleport, enable, and velocity commands make the drag handoff explicit.",
      "Pointer-release velocity comes from the recent captured pointer trail, is capped, and lets the ball roll under ordinary physics.",
      "Collider-only descendants share their nearest body and can act as sensors without contributing solid response.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["signals-and-animation", "group", "circle"],
    load: () => import("./learning/composition/physics-2d.example"),
  },
  {
    slug: "layer",
    title: "Layer",
    shortTitle: "Layer",
    section: "composition",
    order: 122,
    summary:
      "Render a subtree on an offscreen Canvas, then compose it into the main scene.",
    api: ["Layer"],
    objectives: [
      "Pass multiple direct children into one cached offscreen layer.",
      "Control layer dimensions and preserve child interaction.",
    ],
    prompts: {
      gesture: "Click the mint badge rendered inside the layer.",
      code: "Change the layer size and move the badge within its bounds.",
    },
    apiNotes: [
      "Layer receives normal children and caches their offscreen result without retaining drawing commands.",
      "Layer children still participate in the root scene’s global paint and target order.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["group", "clip", "overlap-and-paint-order"],
    load: () => import("./learning/composition/layer.example"),
  },
  {
    slug: "absolute-and-overlay",
    title: "Absolute and overlay",
    shortTitle: "Absolute + overlay",
    section: "layout",
    order: 123,
    summary:
      "Place one panel explicitly, then align reusable children inside its overlay.",
    api: ["Absolute", "Overlay"],
    objectives: [
      "Position a child with `left` and `top` inside an absolute layout.",
      "Align overlapping children with overlay container and item styles.",
    ],
    prompts: {
      gesture: "Click the centered coral card to change its label.",
      code: "Move the panel or change the card's self-alignment.",
    },
    apiNotes: [
      "Absolute placement uses parent-facing `left` and `top` values.",
      "Overlay preserves source paint order while aligning every child in one area.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["flow", "flex", "grid"],
    load: () => import("./learning/layout/absolute-and-overlay.example"),
  },
  {
    slug: "flow",
    title: "Flow layout",
    shortTitle: "Flow",
    section: "layout",
    order: 124,
    summary:
      "Arrange declared and measured items in a compact wrapping Canvas flow.",
    api: ["Flow", "Text"],
    objectives: [
      "Choose horizontal flow, gaps, and wrapping.",
      "Mix declared boxes with text measured by CRC.",
    ],
    prompts: {
      gesture: "Click a color chip to highlight it.",
      code: "Narrow the flow or switch its direction to vertical.",
    },
    apiNotes: [
      "Flow wraps before a nonempty line exceeds its finite bound.",
      "Auto-sized text opts into pure measurement without speculative rendering.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["absolute-and-overlay", "flex", "grid"],
    load: () => import("./learning/layout/flow.example"),
  },
  {
    slug: "responsive-styles",
    title: "Responsive local styles",
    shortTitle: "Responsive styles",
    section: "layout",
    order: 129,
    summary:
      "A store revenue card adapts from a full dashboard to a narrow sidebar or phone.",
    api: ["Flow", "Grid", "useLayoutBox"],
    objectives: [
      "Reflow metrics and chart placement with local width rules.",
      "Distinguish outer placement styles from internal responsive content.",
    ],
    prompts: {
      gesture:
        "Select 30 days, then try Dashboard, Sidebar, and Phone. The same card retains your selection.",
      code: "Change the 600-unit width threshold in the card styles to move the stacking breakpoint.",
    },
    apiNotes: [
      "An outer layout-item rule sees its parent's content size; inner rules see the assigned allocation.",
      "Rules do not imply touch capability or conditional structure.",
    ],
    canvas: { width: 1000, height: 800 },
    related: ["flow", "grid"],
    load: () => import("./learning/layout/responsive-styles.example"),
  },
  {
    slug: "flex",
    title: "Flex layout",
    shortTitle: "Flex",
    section: "layout",
    order: 125,
    summary:
      "Distribute positive and negative free space with CRC's CSS-compatible Flex subset.",
    api: ["Flex", "useLayoutBox"],
    objectives: [
      "Distribute main-axis space with flex basis, grow, and shrink.",
      "Let a plain child expose specified style to Flex, then read its finite local allocation with useLayoutBox.",
    ],
    prompts: {
      gesture: "Click either card to swap its emphasis.",
      code: "Change the grow factors or center the row with `justifyContent`.",
    },
    apiNotes: [
      "The parent consumes each child's specified style; the plain child still receives that author value unchanged.",
      "`useLayoutBox()` reports the allocated local box for drawing, while reverse order, baseline, auto margins, and percentage gaps remain deferred.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["flow", "grid", "absolute-and-overlay"],
    load: () => import("./learning/layout/flex.example"),
  },
  {
    slug: "grid",
    title: "Grid layout",
    shortTitle: "Grid",
    section: "layout",
    order: 126,
    summary:
      "Build an explicit responsive grid from fixed, percentage, and fractional tracks.",
    api: ["Grid"],
    objectives: [
      "Declare explicit rows and columns with fixed, percentage, and `fr` tracks.",
      "Place and span every child with one-based grid coordinates.",
    ],
    prompts: {
      gesture: "Click the spanning feature card to change its color.",
      code: "Change the fractional ratio or move a card to another explicit area.",
    },
    apiNotes: [
      "Every Grid child declares its start coordinates; no implicit tracks are created.",
      "Overlapping grid areas retain source paint and target order.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["flex", "flow", "absolute-and-overlay"],
    load: () => import("./learning/layout/grid.example"),
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
      "With focus management, an enrolled click target also receives familiar Enter and Space activation; Canvas regions still do not gain native button semantics.",
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
      "`relatedTarget` is the opposite opaque CRC target; `originalEvent.relatedTarget` retains the browser's native value.",
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
    slug: "pointer-events",
    title: "Pointer events",
    shortTitle: "Pointer events",
    section: "user-events",
    order: 210,
    summary:
      "Handle one DOM-shaped stream across mouse, pen, and touch pointers while keeping Canvas targeting explicit.",
    api: [
      "onPointerOver",
      "onPointerEnter",
      "onPointerDown",
      "onPointerMove",
      "onPointerRawUpdate",
      "onPointerUp",
      "onPointerCancel",
      "onPointerOut",
      "onPointerLeave",
    ],
    objectives: [
      "Read logical coordinates and device-specific pointer fields from one event facade.",
      "Distinguish bubbling over/out transitions from exclusive enter/leave boundaries.",
    ],
    prompts: {
      gesture:
        "Move, press, and release with a mouse, pen, or touch contact; compare the trace and pointer fields.",
      code: "Use `pressure` or `pointerType` to vary the marker size.",
    },
    apiNotes: [
      "Pointer events preserve browser `pointerType`, pressure, tilt, dimensions, buttons, and root-logical coordinates.",
      "`pointerrawupdate` and `pointercancel` depend on browser/device behavior, so the handlers remain useful even when a mouse cannot produce them on demand.",
    ],
    canvas: { width: 720, height: 420 },
    related: [
      "pointer-capture",
      "touch-events",
      "mouse-boundaries-and-auxiliary-click",
    ],
    load: () => import("./learning/user-events/pointer-events.example"),
  },
  {
    slug: "pointer-capture",
    title: "Pointer capture",
    shortTitle: "Pointer capture",
    section: "user-events",
    order: 220,
    summary:
      "Keep a drag routed to its original logical target after the pointer leaves the painted geometry.",
    api: [
      "setPointerCapture",
      "hasPointerCapture",
      "releasePointerCapture",
      "onGotPointerCapture",
      "onLostPointerCapture",
    ],
    objectives: [
      "Acquire and release capture through the opaque logical event target.",
      "Observe capture ownership and lifecycle events without retaining a scene graph.",
    ],
    prompts: {
      gesture:
        "Press the handle, drag outside it, then release; repeat with the explicit release control.",
      code: "Release capture after a distance threshold instead of on pointer up.",
    },
    apiNotes: [
      "Capture is isolated per `pointerId` and uses the root HTML Canvas for native ownership.",
      "Target removal, pointer cancellation, native loss, and disposal clear capture exactly.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["pointer-events", "propagation-and-cancellation"],
    load: () => import("./learning/user-events/pointer-capture.example"),
  },
  {
    slug: "touch-events",
    title: "Touch events",
    shortTitle: "Touch events",
    section: "user-events",
    order: 230,
    summary:
      "Track multi-contact Touch Events and keep each changed contact owned by its starting logical target.",
    api: ["onTouchStart", "onTouchMove", "onTouchEnd", "onTouchCancel"],
    objectives: [
      "Inspect touches, targetTouches, changedTouches, and logical coordinates.",
      "Understand retained per-contact targeting across movement and terminal events.",
    ],
    prompts: {
      gesture:
        "Use one or two fingers on a touch device, move outside the starting pad, and lift each contact.",
      code: "Draw one marker per item in `changedTouches`.",
    },
    apiNotes: [
      "CRC preserves the native `TouchList` objects while grouping changed contacts by retained logical owner.",
      "Pointer Events are preferred for unified device input; Touch Events remain valuable for native multi-touch lists.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["pointer-events", "pointer-capture", "wheel"],
    load: () => import("./learning/user-events/touch-events.example"),
  },
  {
    slug: "wheel",
    title: "Wheel input",
    shortTitle: "Wheel",
    section: "user-events",
    order: 240,
    summary:
      "Read wheel deltas over a targeted region and deliberately decide whether the page should keep scrolling.",
    api: ["onWheel", "preventDefault"],
    objectives: [
      "Read delta axes, mode, modifiers, and root-logical coordinates.",
      "Cancel native wheel behavior only while an in-canvas interaction owns it.",
    ],
    prompts: {
      gesture:
        "Wheel over the cobalt dial, then wheel over the surrounding page and compare the behavior.",
      code: "Switch from vertical `deltaY` to a two-axis pan using `deltaX` too.",
    },
    apiNotes: [
      "Logical `preventDefault()` forwards to the native cancelable WheelEvent.",
      "Wheel listeners are installed non-passively only while a live registration requires them.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["touch-events", "propagation-and-cancellation"],
    load: () => import("./learning/user-events/wheel.example"),
  },
  {
    slug: "mouse-boundaries-and-auxiliary-click",
    title: "Mouse boundaries and auxiliary click",
    shortTitle: "Mouse boundaries + aux",
    section: "user-events",
    order: 250,
    summary:
      "Complete the mouse family with exclusive enter/leave boundaries and non-primary-button activation.",
    api: ["onMouseEnter", "onMouseLeave", "onAuxClick"],
    objectives: [
      "Compare non-bubbling enter/leave with bubbling over/out transitions.",
      "Handle auxiliary-button activation separately from primary click.",
    ],
    prompts: {
      gesture:
        "Cross the nested boundaries, then middle-click or use another auxiliary mouse button on the card.",
      code: "Show `button` and `buttons` beside each auxiliary activation.",
    },
    apiNotes: [
      "Enter and leave run capture and target phases but do not bubble.",
      "Auxiliary click keeps an activation history independent of the primary click sequence.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["mouse-over", "mouse-out", "event-sequences"],
    load: () =>
      import("./learning/user-events/mouse-boundaries-and-auxiliary-click.example"),
  },
  {
    slug: "propagation-and-cancellation",
    title: "Propagation and cancellation",
    shortTitle: "Propagation + cancellation",
    section: "user-events",
    order: 260,
    summary:
      "Trace CRC capture, target, and bubble phases and choose where logical and native defaults stop.",
    api: [
      "useEventListener",
      "onClickCapture",
      "composedPath",
      "preventDefault",
      "stopPropagation",
      "stopImmediatePropagation",
    ],
    objectives: [
      "Read target, currentTarget, relatedTarget, phase, and the temporary composed path.",
      "Compare default cancellation, propagation stopping, and immediate stopping.",
    ],
    prompts: {
      gesture:
        "Click each cancellation mode and compare which capture, target, and bubble entries remain in the trace.",
      code: "Move a stop call from the target to an ancestor capture handler.",
    },
    apiNotes: [
      "`useEventListener` observes events on component ancestry without creating hit geometry or a focus candidate.",
      "The logical path is snapshotted for one dispatch; event targets are opaque CRC values, not DOM nodes.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["custom-event-targets", "pointer-capture", "event-sequences"],
    load: () =>
      import("./learning/user-events/propagation-and-cancellation.example"),
  },
  {
    slug: "custom-event-targets",
    title: "Custom event targets",
    shortTitle: "Custom targets",
    section: "user-events",
    order: 270,
    summary:
      "Give one conceptual custom component an explicit Path2D target without hoisting child geometry.",
    api: ["useEventTarget", "CRCEventTargetOptions", "Path2D"],
    objectives: [
      "Register grouped handlers and an explicit fill or stroke interaction path.",
      "Keep custom target ownership separate from the visual children it returns.",
    ],
    prompts: {
      gesture:
        "Move around the star and its wide stroked orbit, including transparent areas inside the component's box.",
      code: "Change `lineInteractionWidth` without changing the painted stroke width.",
    },
    apiNotes: [
      "CRC never infers or aggregates a custom component's target from returned descendants.",
      "The target captures the current transforms, clips, cursor, hit options, and component identity.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["propagation-and-cancellation", "hit-areas-and-cursors"],
    load: () => import("./learning/user-events/custom-event-targets.example"),
  },
  {
    slug: "drag-and-drop",
    title: "Drag and drop",
    shortTitle: "Drag and drop",
    section: "user-events",
    order: 280,
    summary:
      "Route browser drag sources and drops through logical Canvas targets with data and root-local coordinates intact.",
    api: [
      "onDragStart",
      "onDrag",
      "onDragEnd",
      "onDragEnter",
      "onDragLeave",
      "onDragOver",
      "onDrop",
    ],
    objectives: [
      "Handle source, boundary, hover, terminal, and drop phases.",
      "Use dataTransfer and cancel drag-over when a region accepts a drop.",
    ],
    prompts: {
      gesture:
        "Drag the ticket between the two drop zones, or drag a file from the desktop onto a zone.",
      code: "Accept only one `dataTransfer.types` value in `onDragOver`.",
    },
    apiNotes: [
      "`dragenter` and `dragleave` follow logical ancestry changes and expose the opposite logical target.",
      "CRC deliberately resolves `drag` and `dragend` at the current coordinate instead of retaining a DOM-like source target.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["pointer-capture", "propagation-and-cancellation"],
    load: () => import("./learning/user-events/drag-and-drop.example"),
  },
  {
    slug: "focus-management",
    title: "Focus management",
    shortTitle: "Focus management",
    section: "keyboard-focus",
    order: 290,
    summary:
      "Opt one Canvas subtree into logical focus, natural Tab traversal, focus events, and render-time focus visuals.",
    api: [
      "FocusManagement",
      "keyboardFocusable",
      "isFocused",
      "isFocusVisible",
      "onFocus",
      "onBlur",
      "onFocusIn",
      "onFocusOut",
    ],
    objectives: [
      "Understand automatic and explicit focus-candidate enrollment.",
      "Render high-contrast focus and focus-visible states while Tab crosses surrounding DOM controls.",
    ],
    prompts: {
      gesture:
        "Tab into and through the Canvas, Shift+Tab back out, then click the explicit and excluded targets.",
      code: "Switch a target between automatic, explicit-true, and explicit-false enrollment.",
    },
    apiNotes: [
      "`FocusManagement` is additive; without it, focus metadata is inert and no tabindex or document listener is installed.",
      "The Canvas remains the single native focus host; logical targets create no DOM semantics or accessibility tree, so provide an equivalent semantic DOM experience separately.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["keyboard-events-and-activation", "directional-navigation"],
    load: () => import("./learning/keyboard-focus/focus-management.example"),
  },
  {
    slug: "keyboard-events-and-activation",
    title: "Keyboard events and activation",
    shortTitle: "Keyboard + activation",
    section: "keyboard-focus",
    order: 300,
    summary:
      "Deliver key events to the focused logical target and reuse click handlers for familiar Enter and Space activation.",
    api: ["onKeyDown", "onKeyUp", "onClick", "sourceEvent"],
    objectives: [
      "Read key, code, modifiers, repeat, location, and composition state.",
      "Compare Enter keydown and Space keyup activation with prevented custom keys.",
    ],
    prompts: {
      gesture:
        "Focus a control, press Enter, press and release Space, then try the custom prevented key.",
      code: "Handle another key and call `preventDefault()` before CRC's activation policy runs.",
    },
    apiNotes: [
      "Keyboard-generated clicks use `detail: 0` and expose the originating KeyboardEvent as `sourceEvent`.",
      "Pending Space activation is canceled by focus movement, blur, unmount, handler removal, or disposal; the single Canvas focus host still creates no semantic control.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["focus-management", "directional-navigation"],
    load: () =>
      import("./learning/keyboard-focus/keyboard-events-and-activation.example"),
  },
  {
    slug: "directional-navigation",
    title: "Directional navigation",
    shortTitle: "Directional navigation",
    section: "keyboard-focus",
    order: 310,
    summary:
      "Move through arbitrary spatial targets with arrows while Tab remains left-to-right and top-to-bottom by source order.",
    api: ["KeyboardNavigation", "keyboardNavigationBounds"],
    objectives: [
      "Add a directional boundary without requiring a Grid component.",
      "Keep source-order Tab traversal independent from geometry-ranked arrow navigation.",
    ],
    prompts: {
      gesture:
        "Tab from the top actions into the squares, use all four arrows, then Tab to the bottom actions.",
      code: "Move one square's navigation bounds to make an irregular spatial layout.",
    },
    apiNotes: [
      "Arrow selection prefers perpendicular overlap, then forward distance, perpendicular distance, and source order.",
      "Directional movement does not wrap; it moves logical focus inside one native Canvas host and does not create DOM semantics.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["focus-management", "nested-directional-navigation"],
    load: () =>
      import("./learning/keyboard-focus/directional-navigation.example"),
  },
  {
    slug: "nested-directional-navigation",
    title: "Nested directional navigation",
    shortTitle: "Nested navigation",
    section: "keyboard-focus",
    order: 320,
    summary:
      "Compose a directional grid inside another directional grid while keeping arrow ownership visible and local.",
    api: ["FocusManagement", "KeyboardNavigation", "keyboardNavigationBounds"],
    objectives: [
      "Keep the nearest directional boundary in exclusive control of its descendants.",
      "Compare boundary-local arrow movement with one global source-order Tab sequence.",
    ],
    prompts: {
      gesture:
        "Arrow from the outer-left card through the inner-grid entry to outer-right, then Tab into the inner rectangles and test every edge.",
      code: "Move an inner rectangle's `keyboardNavigationBounds` and observe how only the inner arrow route changes.",
    },
    apiNotes: [
      "Targets inside a nested boundary are excluded from the outer boundary's direct arrow candidates.",
      "Tab ignores directional boundaries and follows one logical list on the single Canvas focus host, without generating an accessibility tree.",
    ],
    canvas: { width: 720, height: 520 },
    related: ["directional-navigation", "keyboard-events-and-activation"],
    load: () =>
      import("./learning/keyboard-focus/nested-directional-navigation.example"),
  },
  {
    slug: "editing-composition-and-clipboard",
    title: "Editing, composition, and clipboard transport",
    shortTitle: "Editing + clipboard",
    section: "keyboard-focus",
    order: 330,
    summary:
      "Observe DOM-shaped editing and clipboard event facades while keeping real text editing and semantics in application-owned DOM.",
    api: [
      "onBeforeInput",
      "onInput",
      "onChange",
      "onCompositionStart",
      "onCompositionUpdate",
      "onCompositionEnd",
      "onSelect",
      "onSelectionChange",
      "onCopy",
      "onCut",
      "onPaste",
    ],
    objectives: [
      "Inspect input, composition, selection, and clipboard family fields on a focused logical target.",
      "Keep CRC transport separate from editable controls and accessible semantics.",
    ],
    prompts: {
      gesture:
        "Focus the Canvas target, trigger its editing sequence, then try the copy, cut, and paste shortcuts.",
      code: "Record `inputType`, `data`, `isComposing`, or clipboard types in the visible trace.",
    },
    apiNotes: [
      "A plain Canvas is not an editing host; the lesson emits native editing events only to demonstrate CRC transport.",
      "The Canvas stays the only native focus host; applications own editable DOM, selection, semantic roles, announcements, and synchronization with Canvas visuals.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["focus-management", "keyboard-events-and-activation"],
    load: () =>
      import("./learning/keyboard-focus/editing-composition-and-clipboard.example"),
  },
  {
    slug: "event-sequences",
    title: "Event sequences",
    shortTitle: "Event sequences",
    section: "advanced-interactions",
    order: 340,
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
      "Direct handlers participate in CRC's temporary capture/target/bubble path through mounted component ancestry.",
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
    order: 350,
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
    order: 360,
    summary:
      "See why the last visible mark under the pointer becomes the one logical target.",
    api: ["Rectangle", "onClick"],
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
    order: 370,
    summary:
      "Combine transforms, clips, and offscreen layers while keeping visible paint and mouse targeting aligned.",
    api: ["Group", "Clip", "Layer", "onClick"],
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
    const expectedBrowseGroup = browseGroupFor(entry.section, entry.slug);
    if (entry.browseGroup !== expectedBrowseGroup) {
      throw new Error(
        `Learning example "${entry.slug}" has an invalid public browse group.`,
      );
    }
    if (!entry.browseGroup && !(entry.slug in introductionRoutes)) {
      throw new Error(
        `Learning example "${entry.slug}" must belong to a public browse group.`,
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
      !isLearningSourcePath(entry.source.path, entry.section, entry.slug)
    ) {
      throw new Error(
        `Learning example "${entry.slug}" must have one unique .example.tsx source path.`,
      );
    }
    if (entry.authoring !== "jsx" && entry.authoring !== "createElement") {
      throw new Error(
        `Learning example "${entry.slug}" has an invalid authoring mode.`,
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
    if (new Set(entry.api).size !== entry.api.length) {
      throw new Error(
        `Learning example "${entry.slug}" has duplicate public API tags.`,
      );
    }
    const hasCreateElementTag = entry.api.includes("createElement");
    const hasNonJsxTag = entry.api.includes("non-jsx");
    if (
      entry.authoring === "createElement"
        ? !hasCreateElementTag || !hasNonJsxTag
        : hasCreateElementTag || hasNonJsxTag
    ) {
      throw new Error(
        `Learning example "${entry.slug}" has reserved authoring tags that disagree with its authoring mode.`,
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

  const createElementEntries = catalog.filter(
    (entry) => entry.authoring === "createElement",
  );
  const gettingStartedIndex = catalog.findIndex(
    (entry) => entry.slug === "getting-started",
  );
  if (
    createElementEntries.length !== 1 ||
    catalog[gettingStartedIndex + 1] !== createElementEntries[0]
  ) {
    throw new Error(
      "The learning catalog must place exactly one createElement/non-jsx lesson immediately after getting started.",
    );
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
  orderedDrafts.map((draft, index): LearningExampleCatalogEntry => {
    const browseGroup = browseGroupFor(draft.section, draft.slug);
    return {
      ...draft,
      authoring: "authoring" in draft ? draft.authoring : "jsx",
      ...(browseGroup ? { browseGroup } : {}),
      source: { path: sourcePath(draft.section, draft.slug) },
      relationships: {
        previous: orderedDrafts[index - 1]?.slug,
        next: orderedDrafts[index + 1]?.slug,
        related: draft.related ?? [],
      },
      load: async () => (await draft.load()) as never,
    };
  }),
);

export function getLearningExampleBySlug(
  slug: string,
): LearningExampleCatalogEntry | undefined {
  return learningExampleCatalog.find((entry) => entry.slug === slug);
}

export function getLearningExampleRoute(
  entry: LearningExampleMetadata,
): string {
  if (entry.browseGroup) {
    return `#/examples/${entry.browseGroup}/${entry.slug}`;
  }
  const introductionRoute =
    introductionRoutes[entry.slug as keyof typeof introductionRoutes];
  if (!introductionRoute) {
    throw new Error(
      `Learning example "${entry.slug}" has no canonical public route.`,
    );
  }
  return introductionRoute;
}

export function getLearningExampleLegacyRoutes(
  entry: LearningExampleMetadata,
): readonly string[] {
  const legacyRoute = `#/examples/${entry.section}/${entry.slug}`;
  return legacyRoute === getLearningExampleRoute(entry) ? [] : [legacyRoute];
}

export function getLearningExamplesBySection(
  section: LearningSectionId,
): readonly LearningExampleCatalogEntry[] {
  return learningExampleCatalog.filter((entry) => entry.section === section);
}

export function getLearningExamplesByBrowseGroup(
  group: LearningBrowseGroup,
): readonly LearningExampleCatalogEntry[] {
  return learningExampleCatalog
    .filter((entry) => entry.browseGroup === group)
    .sort((left, right) =>
      left.shortTitle.localeCompare(right.shortTitle, "en"),
    );
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
