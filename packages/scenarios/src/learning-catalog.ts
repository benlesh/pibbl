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
    id: "layout",
    label: "Layout",
    description: "Arrange reusable Canvas components with declared boxes.",
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
      "Add logical focus, keyboard activation, and directional navigation.",
    order: 7,
  },
  {
    id: "advanced-interactions",
    label: "Advanced interactions",
    description: "Reason about ordering, hit geometry, and composed targets.",
    order: 8,
  },
] as const satisfies readonly LearningSection[];

interface LearningDraft extends Omit<
  LearningExampleMetadata,
  "relationships" | "source"
> {
  related?: readonly string[];
  load: () => Promise<unknown>;
}

function sourcePath(
  section: LearningSectionId,
  slug: string,
  extension: "ts" | "tsx" = "ts",
): string {
  return `packages/scenarios/src/learning/${section}/${slug}.example.${extension}`;
}

function isLearningSourcePath(
  path: string,
  section: LearningSectionId,
  slug: string,
): boolean {
  return (
    path === sourcePath(section, slug, "ts") ||
    path === sourcePath(section, slug, "tsx")
  );
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
    slug: "absolute-and-overlay",
    title: "Absolute and overlay",
    shortTitle: "Absolute + overlay",
    section: "layout",
    order: 121,
    summary: "Place one panel explicitly, then align reusable children inside its overlay.",
    api: ["absolute", "overlay"],
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
    summary: "Arrange declared and measured items in a compact wrapping Canvas flow.",
    api: ["flow", "text"],
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
    summary: "Distribute positive and negative free space with CRC's CSS-compatible Flex subset.",
    api: ["flex"],
    objectives: [
      "Distribute main-axis space with flex basis, grow, and shrink.",
      "Align cards across the cross axis with familiar Flex values.",
    ],
    prompts: {
      gesture: "Click either card to swap its emphasis.",
      code: "Change the grow factors or center the row with `justifyContent`.",
    },
    apiNotes: [
      "Supported Flex values intentionally follow their CSS meaning.",
      "Reverse order, baseline, auto margins, and percentage gaps remain deferred.",
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
    summary: "Build an explicit responsive grid from fixed, percentage, and fractional tracks.",
    api: ["grid"],
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
    related: ["pointer-capture", "touch-events", "mouse-boundaries-and-auxiliary-click"],
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
      "Logical Canvas focus is keyboard interaction, not screen-reader semantics; provide an equivalent semantic DOM experience separately.",
    ],
    canvas: { width: 720, height: 420 },
    related: ["keyboard-events-and-activation", "directional-navigation"],
    load: () =>
      import("./learning/keyboard-focus/focus-management.example"),
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
      "Pending Space activation is canceled by focus movement, blur, unmount, handler removal, or disposal.",
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
      "Directional movement does not wrap; with no candidate, focus and native default prevention remain unchanged.",
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
    api: [
      "FocusManagement",
      "KeyboardNavigation",
      "keyboardNavigationBounds",
    ],
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
      "Tab ignores directional boundaries and follows the single committed source-order focus list.",
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
      "Applications own editable DOM, selection, semantic roles, announcements, and synchronization with Canvas visuals.",
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
    order: 370,
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
      !isLearningSourcePath(entry.source.path, entry.section, entry.slug)
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
