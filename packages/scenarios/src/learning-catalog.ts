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
      "Arrange declared boxes and distinguish specified style from crcLayoutBox allocation.",
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
    id: "webgl",
    label: "WebGL",
    description:
      "Light settled 3D scenes with editable materials, normals, and backgrounds.",
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
  if (section === "webgl") return "webgl";
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
      "crcState",
      "crcWhenChanged",
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
    slug: "signals",
    title: "Signals",
    shortTitle: "Signals",
    section: "start",
    order: 17,
    summary:
      "Read writable and computed values explicitly, then update a shared signal without turning styles into bindings.",
    api: ["signal", "computed", "crcSignal"],
    objectives: [
      "Use .get() during a component render to declare the values that should refresh it.",
      "Update writable signals from an event and derive a normal resolved value with computed().",
    ],
    prompts: {
      gesture:
        "Click the blue card to move it and switch its component-local color.",
      code: "Change the x update or derive another label from the shared writable signal.",
    },
    apiNotes: [
      "Calling .get() is the explicit dependency declaration; a changed write schedules one future CRC frame.",
      "The style object contains ordinary resolved values, and a module-level signal can be shared independently of any mount.",
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
      "`crcMemo` keeps the created hexagon path stable while its dependencies are unchanged.",
      "`createRegularPolygonPath` uses sides, center coordinates, and exactly one size mode such as inradius.",
      "Nested clips intersect, matching Canvas clipping behavior.",
      "Clip receives children directly, and both paint and targeting are constrained by its active path.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["group", "layer", "transformed-clipped-layered-targets"],
    load: () => import("./learning/composition/clip.example"),
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
    slug: "webgl-islands",
    title: "WebGL islands",
    shortTitle: "WebGL islands",
    section: "composition",
    order: 117,
    summary:
      "Compose an animated WebGL2 cube and sphere between ordinary Canvas 2D paint.",
    api: ["WebGLLayer", "Group3D", "Cube", "Sphere", "crcAnimationFrame"],
    objectives: [
      "Place one transparent WebGL island between Canvas background and overlay content.",
      "Animate a Group3D with CRC frame time and select Cube or Sphere through ordinary event handlers.",
    ],
    prompts: {
      gesture: "Click the rotating cube and sphere to change their colors.",
      code: "Change either 3D translation or replace the animated Y rotation with an X rotation.",
    },
    apiNotes: [
      "WebGLLayer uses the same CRC JSX runtime, component identity, hooks, and event vocabulary as Canvas components.",
      "The omitted camera uses the documented perspective default; transparent island pixels reveal earlier Canvas paint.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["group", "layer", "overlap-and-paint-order"],
    load: () => import("./learning/composition/webgl-islands.example"),
  },
  {
    slug: "signals-and-animation",
    title: "Signals and animation",
    shortTitle: "Signals + animation",
    section: "composition",
    order: 118,
    summary:
      "Compose immutable animation definitions into one component-owned program whose committed signal values enter ordinary styles explicitly.",
    api: [
      "crcSignal",
      "crcTransition",
      "crcPlayback",
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
      "Definitions and programs are immutable descriptions; crcPlayback supplies the stateful component owner and snapshots an accepted run.",
      "All playbacks advance in shared scheduler phases and publish one central Commit before affected CRC roots render.",
      "Signals declare dependencies through explicit .get() calls, so style receives ordinary numbers rather than signal or animation objects.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["signals", "group", "layer"],
    load: () => import("./learning/composition/signals-and-animation.example"),
  },
  {
    slug: "physics-2d",
    title: "2D physics",
    shortTitle: "2D physics",
    section: "composition",
    order: 119,
    summary:
      "Drag and drop a dynamic ball through static bumpers and a collider-only sensor in one scheduler-owned 2D physics world.",
    api: [
      "PhysicsWorld2D",
      "dynamicBody2D",
      "staticBody2D",
      "collider2D",
      "crcPhysicsBody2D",
      "crcRef",
      "crcState",
      "setPointerCapture",
    ],
    objectives: [
      "Attach static and dynamic bodies to ordinary CRC drawing primitives, then add solid bumpers and a collider-only sensor.",
      "Capture one pointer while application-owned coordinates drag a disabled body, then return pose ownership to physics on release.",
    ],
    prompts: {
      gesture: "Drag the blue ball above a bumper and release it.",
      code: "Change gravity, bumper restitution, or the drag bounds while leaving the world on CRC's shared scheduler.",
    },
    apiNotes: [
      "An enabled dynamic root pose is physics-owned; disable physics before animating authored position, then explicitly re-enable it.",
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
    order: 120,
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
    order: 121,
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
    order: 122,
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
    slug: "flex",
    title: "Flex layout",
    shortTitle: "Flex",
    section: "layout",
    order: 123,
    summary:
      "Distribute positive and negative free space with CRC's CSS-compatible Flex subset.",
    api: ["Flex", "crcLayoutBox"],
    objectives: [
      "Distribute main-axis space with flex basis, grow, and shrink.",
      "Let a plain child expose specified style to Flex, then read its finite local allocation with crcLayoutBox.",
    ],
    prompts: {
      gesture: "Click either card to swap its emphasis.",
      code: "Change the grow factors or center the row with `justifyContent`.",
    },
    apiNotes: [
      "The parent consumes each child's specified style; the plain child still receives that author value unchanged.",
      "`crcLayoutBox()` reports the allocated local box for drawing, while reverse order, baseline, auto margins, and percentage gaps remain deferred.",
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
    order: 124,
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
      "crcEventListener",
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
      "`crcEventListener` observes events on component ancestry without creating hit geometry or a focus candidate.",
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
    api: ["crcEventTarget", "CRCEventTargetOptions", "Path2D"],
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
  {
    slug: "lit-and-unlit",
    title: "Lit and unlit meshes",
    shortTitle: "Lit and unlit",
    section: "webgl",
    order: 380,
    summary:
      "Compare the default Lambert-lit result with one mesh that explicitly ignores every scene light.",
    api: ["WebGLLayer", "Cube", "Sphere", "Mesh", "lit"],
    objectives: [
      "See that lit geometry without a light resolves to black apart from emission.",
      "Set style.lit to false when a mesh should retain its base color without lighting.",
    ],
    prompts: {
      gesture: "Drag to orbit, use the wheel to zoom, and compare the colored unlit cube with the black lit sphere and ground.",
      code: "Change cubeLit to true, then add an AmbientLight to compare both modes.",
    },
    apiNotes: [
      "Mesh, Cube, and Sphere are Lambert-lit by default; style.lit is the explicit per-mesh opt-out.",
      "A lit non-emissive mesh in a scene with no lights renders black.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["ambient-light", "emissive-material"],
    load: () => import("./learning/webgl/lit-and-unlit.example"),
  },
  {
    slug: "ambient-light",
    title: "Ambient light",
    shortTitle: "Ambient light",
    section: "webgl",
    order: 390,
    summary:
      "Add an even scene-wide fill that does not depend on position, direction, or surface orientation.",
    api: ["AmbientLight", "WebGLLayer"],
    objectives: [
      "Use color and intensity to tune a uniform fill light.",
      "Recognize that AmbientLight contributes equally to every lit surface.",
    ],
    prompts: {
      gesture: "Drag to orbit, use the wheel to zoom, and compare the equally visible faces of the cube and smooth sphere.",
      code: "Lower intensity or tint color to make the ambient contribution easier to isolate.",
    },
    apiNotes: [
      "AmbientLight has no transform because its contribution is uniform everywhere.",
      "Ambient fill has no singular light-space view, so it cannot cast a direct shadow.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["hemisphere-light", "multiple-lights"],
    load: () => import("./learning/webgl/ambient-light.example"),
  },
  {
    slug: "hemisphere-light",
    title: "Hemisphere light",
    shortTitle: "Hemisphere light",
    section: "webgl",
    order: 400,
    summary:
      "Blend separate sky and ground colors across each surface using a transformable local up axis.",
    api: ["HemisphereLight", "WebGLLayer"],
    objectives: [
      "Set independent skyColor and groundColor contributions.",
      "Rotate transformed local +Y to change the hemisphere sky axis.",
    ],
    prompts: {
      gesture: "Drag to orbit, use the wheel to zoom, and compare the sphere’s sky-facing and ground-facing gradients.",
      code: "Swap the sky and ground colors or rotate the light around Z.",
    },
    apiNotes: [
      "HemisphereLight uses transformed local +Y as its normalized sky axis.",
      "Hemisphere fill has no singular light-space view, so it cannot cast a direct shadow.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["ambient-light", "directional-light"],
    load: () => import("./learning/webgl/hemisphere-light.example"),
  },
  {
    slug: "directional-light",
    title: "Directional light",
    shortTitle: "Directional light",
    section: "webgl",
    order: 410,
    summary:
      "Aim parallel illumination with rotations while translation remains visually irrelevant.",
    api: ["DirectionalLight", "WebGLLayer"],
    objectives: [
      "Use rotations to aim the light’s transformed local -Z direction.",
      "Read flat cube faces and curved sphere normals under parallel light.",
    ],
    prompts: {
      gesture: "Drag to orbit, use the wheel to zoom, and inspect the directional silhouettes on the ground.",
      code: "Edit rotationXDegrees and rotationYDegrees to sweep the light direction.",
    },
    apiNotes: [
      "DirectionalLight emits parallel rays along transformed local -Z.",
      "Translation does not affect a directional light.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["hemisphere-light", "custom-geometry-normals"],
    load: () => import("./learning/webgl/directional-light.example"),
  },
  {
    slug: "point-light",
    title: "Point light",
    shortTitle: "Point light",
    section: "webgl",
    order: 420,
    summary:
      "Place a local light whose inverse-square contribution fades smoothly to zero at its optional range.",
    api: ["PointLight", "WebGLLayer"],
    objectives: [
      "Position a point light with the shared 3D transform fields.",
      "Tune dimensionless intensity and the optional smooth range cutoff.",
    ],
    prompts: {
      gesture: "Drag to orbit, use the wheel to zoom, and inspect the point-light silhouettes from every side.",
      code: "Move translateX or shorten range to expose the local falloff.",
    },
    apiNotes: [
      "PointLight uses the transformed local origin and inverse-square distance falloff.",
      "Range is an optional positive cutoff; omitted range is unbounded.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["spot-light", "transformed-light"],
    load: () => import("./learning/webgl/point-light.example"),
  },
  {
    slug: "spot-light",
    title: "Spot light",
    shortTitle: "Spot light",
    section: "webgl",
    order: 430,
    summary:
      "Shape a transform-aimed local light with editable inner and outer cone half-angles.",
    api: ["SpotLight", "WebGLLayer"],
    objectives: [
      "Position and aim a spot light through its transformed origin and local -Z direction.",
      "Use inner and outer cone angles to control the smooth edge transition.",
    ],
    prompts: {
      gesture: "Drag to orbit, use the wheel to zoom, and inspect the spot cone and cast silhouettes.",
      code: "Narrow outerConeAngleDegrees or rotate the spot away from the sphere.",
    },
    apiNotes: [
      "Spot cone fields are half-angles in degrees and the inner angle cannot exceed the outer angle.",
      "SpotLight combines cone response with the same inverse-square and range behavior as PointLight.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["point-light", "transformed-light"],
    load: () => import("./learning/webgl/spot-light.example"),
  },
  {
    slug: "emissive-material",
    title: "Emissive Lambert material",
    shortTitle: "Emissive material",
    section: "webgl",
    order: 440,
    summary:
      "Make one Lambert surface self-lit without implying bloom, a halo, or illumination of nearby geometry.",
    api: ["CRCWebGLLambertMaterial", "material", "WebGLLayer"],
    objectives: [
      "Set emissiveColor and emissiveIntensity inside the closed Lambert material descriptor.",
      "Distinguish a surface’s emission from light bounce and post-processing bloom.",
    ],
    prompts: {
      gesture: "Drag to orbit, use the wheel to zoom, and notice that emission stays on the sphere rather than lighting nearby meshes.",
      code: "Change emissiveColor or emissiveIntensity and confirm nearby meshes remain unchanged.",
    },
    apiNotes: [
      "Emission adds to the receiving surface whether style.lit is true or false.",
      "Emissive material does not illuminate other meshes and does not create a halo.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["lit-and-unlit", "multiple-lights"],
    load: () => import("./learning/webgl/emissive-material.example"),
  },
  {
    slug: "webgl-background",
    title: "WebGL background",
    shortTitle: "WebGL background",
    section: "webgl",
    order: 450,
    summary:
      "Clear an island to one solid or alpha color while preserving transparent islands as the default.",
    api: ["WebGLBackground", "WebGLLayer"],
    objectives: [
      "Declare one solid-color background independently from scene lighting.",
      "Remove the declaration to reveal the transparent WebGL island default.",
    ],
    prompts: {
      gesture: "Drag to orbit, use the wheel to zoom, and see the two Canvas underlay colors through the alpha background.",
      code: "Change the background alpha, or remove WebGLBackground to restore full transparency.",
    },
    apiNotes: [
      "WebGLBackground affects the clear color only; it never illuminates geometry.",
      "Even an opaque WebGL background remains a miss for the nested interaction resolver.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["ambient-light", "webgl-islands"],
    load: () => import("./learning/webgl/webgl-background.example"),
  },
  {
    slug: "custom-geometry-normals",
    title: "Custom geometry normals",
    shortTitle: "Geometry normals",
    section: "webgl",
    order: 460,
    summary:
      "Give a custom ground mesh explicit vertex normals so it participates in Lambert lighting.",
    api: ["createWebGLGeometry", "CRCWebGLGeometryInput", "Mesh"],
    objectives: [
      "Keep positions, normals, and indices aligned in one immutable geometry descriptor.",
      "Edit the existing upward normal array to understand directional Lambert response.",
    ],
    prompts: {
      gesture: "Drag to orbit, use the wheel to zoom, and compare the flat ground response with curved and face normals.",
      code: "Edit the unchanged ground normal triples while leaving positions and indices intact.",
    },
    apiNotes: [
      "A lit custom geometry requires one finite nonzero XYZ normal for every position triple.",
      "createWebGLGeometry copies the arrays; the descriptor exposes no mutable geometry handles.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["directional-light", "lit-and-unlit"],
    load: () => import("./learning/webgl/custom-geometry-normals.example"),
  },
  {
    slug: "multiple-lights",
    title: "Multiple WebGL lights",
    shortTitle: "Multiple lights",
    section: "webgl",
    order: 470,
    summary:
      "Combine every analytic light family and prove that late JSX siblings illuminate earlier meshes.",
    api: [
      "AmbientLight",
      "HemisphereLight",
      "DirectionalLight",
      "PointLight",
      "SpotLight",
      "WebGLLayer",
    ],
    objectives: [
      "Compose additive ambient, hemisphere, directional, point, and spot contributions.",
      "Place local lights after meshes without changing whole-scene illumination.",
    ],
    prompts: {
      gesture: "Drag to orbit, use the wheel to zoom, and inspect every direct light’s independent ground shadow.",
      code: "Move a late PointLight before the meshes and confirm the rendered result is unchanged.",
    },
    apiNotes: [
      "All eight-or-fewer declarations affect every lit mesh in the settled WebGLLayer regardless of JSX order.",
      "The ninth declaration rejects during settlement instead of being silently truncated.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["ambient-light", "transformed-light"],
    load: () => import("./learning/webgl/multiple-lights.example"),
  },
  {
    slug: "transformed-light",
    title: "Transformed lights",
    shortTitle: "Transformed lights",
    section: "webgl",
    order: 480,
    summary:
      "Animate a Group3D containing point and spot lights while optical settings remain unchanged by scale.",
    api: [
      "Group3D",
      "PointLight",
      "SpotLight",
      "crcSignal",
      "crcPlayback",
      "repeat",
      "track",
      "tween",
    ],
    objectives: [
      "Drive a containing Group3D rotation from an animated signal.",
      "Separate composed light pose from fixed range, intensity, and cone settings.",
    ],
    prompts: {
      gesture: "Drag to orbit, use the wheel to zoom, and watch the transformed point and spot shadows move across the ground.",
      code: "Change group scale and observe pose movement without changing range, intensity, or cone angles.",
    },
    apiNotes: [
      "Group3D composes the point/spot origin and spot direction before the complete scene settles.",
      "Group scale can reposition a nested translated origin; it does not scale range, intensity, or cone angles.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["point-light", "spot-light", "multiple-lights"],
    load: () => import("./learning/webgl/transformed-light.example"),
  },
  {
    slug: "shadow-quality",
    title: "WebGL shadow quality",
    shortTitle: "Shadow quality",
    section: "webgl",
    order: 490,
    summary:
      "Compare familiar disabled, low, medium, and high settings over the same genuine directional shadow map.",
    api: ["CRCWebGLShadowQuality", "WebGLLayer", "DirectionalLight"],
    objectives: [
      "Choose a layer-wide shadow quality tier without exposing renderer texture or filter knobs.",
      "See that every enabled tier remains geometry-based while false disables shadow allocation and sampling.",
    ],
    prompts: {
      gesture: "Orbit behind the cube and sphere to inspect the cast silhouettes from several angles.",
      code: "Change layerShadows from medium to false, low, or high and compare the ground-plane edges.",
    },
    apiNotes: [
      "Omitting style.shadows selects medium; false performs no shadow depth pass.",
      "Low uses a hard comparison while medium and high use progressively wider filtering at higher requested resolutions.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["directional-light", "point-light", "spot-light"],
    load: () => import("./learning/webgl/shadow-quality.example"),
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
