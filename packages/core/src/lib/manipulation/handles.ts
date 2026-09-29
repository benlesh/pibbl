import { createElement } from "../element/create-element.js";
import { setPrimitivePresentation } from "../primitive-presentation.js";
import { getCurrentWorldTransform } from "../render-target.js";
import { GLOBAL_STATE } from "../global-state.js";
import { definePrimitive } from "../define-primitive.js";
import { useEventListener } from "../hooks/use-event-listener.js";
import { useEventTarget } from "../hooks/use-event-target.js";
import { useSignal } from "../hooks/use-signal.js";
import { Group } from "../components/g.js";
import { getLayoutBox } from "../layout/context.js";
import { resolveLength } from "../style/resolve-length.js";
import type { CRCNode } from "../element/types.js";
import type { BoxStyle, LayoutItemStyle } from "../style/types.js";
import type { RenderingContext2D, SystemStyle } from "../types.js";
import type { CRCManipulationController } from "./controller-types.js";
import { manipulationHandlers, type ManipulationState } from "./controller.js";
import { requireManipulationFrame } from "./frame.js";

export interface CRCDragHandleProps {
  readonly formatReadout?: (value: {
    readonly left: number;
    readonly top: number;
  }) => string;
  readonly controller: CRCManipulationController;
  readonly children?: CRCNode;
}
export interface CRCDragHandleStyle extends BoxStyle, LayoutItemStyle {
  readonly readout?: false | true | CRCManipulationReadoutStyle;
  cursor?: string;
}
interface ResolvedDragStyle extends SystemStyle {
  readonly readout?: false | true | CRCManipulationReadoutStyle;
  width: number;
  height: number;
  cursor?: string;
}
interface CssHandleContentProps {
  readonly children?: CRCNode;
}
interface CssHandleContentStyle extends SystemStyle {
  readonly transform: DOMMatrix;
}
/** Private CSS-pixel basis for author-provided handle visuals. */
const CssHandleContent = definePrimitive<
  CssHandleContentProps,
  CssHandleContentStyle
>(
  function CssHandleContent(props) {
    return props.children;
  },
  { childInput: "structural" },
);
setPrimitivePresentation<CssHandleContentStyle>(CssHandleContent, (style) => ({
  transform: style.transform,
}));

export const DragHandle = definePrimitive<
  CRCDragHandleProps,
  CRCDragHandleStyle,
  CRCDragHandleStyle,
  ResolvedDragStyle
>(
  function DragHandle(props, style) {
    requireManipulationFrame(props.controller);
    const focused = useSignal(false);
    const handlers = manipulationHandlers(props.controller, "move");
    useEventListener({
      ...handlers,
      onFocusIn: () => focused.set(true),
      onFocusOut: () => focused.set(false),
    });
    return createElement(Group, {
      style,
      children: [
        props.children,
        createElement(DragReadout, {
          controller: props.controller,
          formatReadout: props.formatReadout,
          readout: style.readout,
          focused: focused.get(),
          anchorX: style.width / 2,
        }),
      ],
    });
  },
  {
    childInput: "structural",
    resolveStyle(style, context) {
      const box = getLayoutBox();
      return {
        width: resolveLength(
          style.width ?? box.width,
          context.percentageBasis.width,
          "width",
          context,
        )!,
        height: resolveLength(
          style.height ?? box.height,
          context.percentageBasis.height,
          "height",
          context,
        )!,
        cursor: style.cursor,
        readout: style.readout,
      };
    },
  },
);

const DragReadout = definePrimitive<
  CRCDragHandleProps & {
    readonly readout?: false | true | CRCManipulationReadoutStyle;
    readonly focused: boolean;
    readonly anchorX: number;
  }
>(function DragReadout(props, _style, ctx) {
  if (!readoutEnabled(props.readout, props.formatReadout)) return;
  const state = requireManipulationFrame(props.controller);
  paintReadout(
    ctx,
    state,
    cssPoint(state, props.anchorX, 0),
    () => {
      const { left, top } = state.options.box.get();
      const value = props.formatReadout
        ? props.formatReadout({ left, top })
        : `left ${round(left)} · top ${round(top)} px`;
      if (typeof value !== "string")
        throw new Error(
          "Manipulation readout formatReadout must return a string.",
        );
      return value;
    },
    props.readout,
    props.focused,
    state.controller.active.get()?.operation === "move",
    "top",
  );
});

export interface CRCManipulationReadoutStateStyle {
  /** Minimum outward spacing in CSS pixels; defaults to 5. */
  readonly gap?: number;
  readonly font?: string;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly opacity?: number;
  readonly visible?: boolean;
}
export interface CRCManipulationReadoutStyle extends CRCManipulationReadoutStateStyle {
  readonly inactive?: CRCManipulationReadoutStateStyle;
  readonly focused?: CRCManipulationReadoutStateStyle;
  readonly active?: CRCManipulationReadoutStateStyle;
}
export interface CRCResizeHandleStyle extends SystemStyle {
  readonly readout?: false | true | CRCManipulationReadoutStyle;
}
export interface CRCRotationConnectorStyle {
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly opacity?: number;
}
export interface CRCRotationArcStyle {
  readonly color?: string;
  readonly sweep?: number;
  readonly strokeWidth?: number;
  readonly opacity?: number;
}
export interface CRCRotationHandleStyle extends SystemStyle {
  readonly connector?: false | true | CRCRotationConnectorStyle;
  readonly arc?: false | true | CRCRotationArcStyle;
  readonly readout?: false | true | CRCManipulationReadoutStyle;
}
export interface CRCResizeHandleProps {
  readonly controller: CRCManipulationController;
  readonly position: import("./types.js").CRCResizePosition;
  readonly hitSize?: number;
  readonly formatReadout?: (value: {
    readonly width: number;
    readonly height: number;
  }) => string;
  readonly children?: CRCNode;
}
export interface CRCResizeHandlesProps {
  readonly controller: CRCManipulationController;
  readonly positions?:
    | "corners"
    | "edges-and-corners"
    | readonly import("./types.js").CRCResizePosition[];
  readonly hitSize?: number;
  readonly style?: CRCResizeHandleStyle;
  readonly formatReadout?: CRCResizeHandleProps["formatReadout"];
}
const corners = [
  "top-left",
  "top-right",
  "bottom-right",
  "bottom-left",
] as const;
const allHandles = [
  "top-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
] as const;
type ResizePosition = (typeof allHandles)[number];
interface CollectionReadout {
  readonly controller: CRCManipulationController;
  readonly positions: readonly ResizePosition[];
  readonly owner: ResizePosition;
  readonly style: CRCResizeHandleStyle | undefined;
  readonly formatReadout: CRCResizeHandleProps["formatReadout"];
  readonly focused: Map<ResizePosition, boolean>;
}
const collectionStack: CollectionReadout[] = [];
const ResizeCollection = definePrimitive<{
  readonly collection: CollectionReadout;
  readonly children?: CRCNode;
}>(
  function ResizeCollection(props) {
    collectionStack.push(props.collection);
    GLOBAL_STATE.componentRefs!.onAfterRender = () => {
      const collection = collectionStack.pop();
      if (collection !== props.collection)
        throw new Error(
          "Manipulation resize collection render context was unbalanced.",
        );
    };
    return props.children;
  },
  { childInput: "structural" },
);

export const ResizeHandle = definePrimitive<
  CRCResizeHandleProps,
  CRCResizeHandleStyle
>(function ResizeHandle(props, style, ctx) {
  const state = requireManipulationFrame(props.controller);
  const box = getLayoutBox();
  const position = props.position as ResizePosition;
  if (!allHandles.includes(position))
    throw new Error("ResizeHandle requires a valid edge or corner position.");
  const x = position.includes("left")
    ? 0
    : position.includes("right")
      ? box.width
      : box.width / 2;
  const y = position.includes("top")
    ? 0
    : position.includes("bottom")
      ? box.height
      : box.height / 2;
  const hitSize = props.hitSize ?? 24;
  if (!Number.isFinite(hitSize) || hitSize <= 0)
    throw new Error("ResizeHandle hitSize must be positive finite CSS pixels.");
  const handlers = manipulationHandlers(props.controller, "resize", position);
  useEventListener(handlers);
  const focus = useEventTarget(handlers, {
    path: cssHandlePath(state, x, y, hitSize),
    fill: true,
    cursor:
      position === "left" || position === "right"
        ? "ew-resize"
        : position === "top" || position === "bottom"
          ? "ns-resize"
          : position === "top-left" || position === "bottom-right"
            ? "nwse-resize"
            : "nesw-resize",
    keyboardFocusable: true,
    keyboardNavigationBounds: { x: x - 4, y: y - 4, width: 8, height: 8 },
  });
  const active = state.controller.active.get();
  const relevant = active?.operation === "resize" && active.handle === position;
  const collection = collectionStack.at(-1);
  if (
    collection?.controller === props.controller &&
    collection.positions.includes(position)
  ) {
    collection.focused.set(position, focus.isFocused);
  } else if (readoutEnabled(style.readout, props.formatReadout)) {
    paintReadout(
      ctx,
      state,
      cssPoint(state, x, y),
      () => formatResize(state, props.formatReadout),
      style.readout,
      focus.isFocused,
      relevant,
      position,
    );
  }
  if (props.children !== undefined)
    return createElement(CssHandleContent, {
      style: { transform: cssHandleChildTransform(state, x, y) },
      children: props.children,
    });
  paintDefaultHandle(ctx, state, x, y);
});
export function ResizeHandles(props: CRCResizeHandlesProps): CRCNode {
  const positions = (
    props.positions === undefined || props.positions === "corners"
      ? corners
      : props.positions === "edges-and-corners"
        ? allHandles
        : props.positions
  ) as readonly ResizePosition[];
  if (positions.length === 0) return [];
  const owner = positions.includes("bottom-right")
    ? "bottom-right"
    : positions.at(-1)!;
  const collection: CollectionReadout = {
    controller: props.controller,
    positions,
    owner,
    style: props.style,
    formatReadout: props.formatReadout,
    focused: new Map(),
  };
  return createElement(ResizeCollection, {
    collection,
    children: [
      ...positions.map((position) =>
        createElement(ResizeHandle, {
          key: position,
          controller: props.controller,
          position,
          hitSize: props.hitSize,
          style: props.style,
          formatReadout: props.formatReadout,
        }),
      ),
      createElement(ResizeCollectionReadout, {
        key: "readout",
        controller: props.controller,
        collection,
      }),
    ],
  });
}
const ResizeCollectionReadout = definePrimitive<{
  readonly controller: CRCManipulationController;
  readonly collection: CollectionReadout;
}>(function ResizeCollectionReadout(props, _style, ctx) {
  const state = requireManipulationFrame(props.controller);
  if (
    !readoutEnabled(
      props.collection.style?.readout,
      props.collection.formatReadout,
    )
  )
    return;
  const active = state.controller.active.get();
  const position =
    active?.operation === "resize" &&
    active.handle &&
    props.collection.positions.includes(active.handle)
      ? active.handle
      : (props.collection.positions.find((candidate) =>
          props.collection.focused.get(candidate),
        ) ?? props.collection.owner);
  const box = getLayoutBox();
  const x = position.includes("left")
    ? 0
    : position.includes("right")
      ? box.width
      : box.width / 2;
  const y = position.includes("top")
    ? 0
    : position.includes("bottom")
      ? box.height
      : box.height / 2;
  paintReadout(
    ctx,
    state,
    cssPoint(state, x, y),
    () => formatResize(state, props.collection.formatReadout),
    props.collection.style?.readout,
    props.collection.focused.get(position) ?? false,
    active?.operation === "resize" && active.handle === position,
    position,
  );
});

export interface CRCRotationHandleProps {
  readonly controller: CRCManipulationController;
  readonly hitSize?: number;
  readonly readoutUnit?: "degrees" | "radians";
  readonly formatReadout?: (value: { readonly rotation: number }) => string;
  readonly children?: CRCNode;
}
export const RotationHandle = definePrimitive<
  CRCRotationHandleProps,
  CRCRotationHandleStyle
>(function RotationHandle(props, style, ctx) {
  const state = requireManipulationFrame(props.controller);
  const box = getLayoutBox();
  const anchor = rotationAnchor(state, box.width, box.height);
  const hitSize = props.hitSize ?? 24;
  if (!Number.isFinite(hitSize) || hitSize <= 0)
    throw new Error(
      "RotationHandle hitSize must be positive finite CSS pixels.",
    );
  const handlers = manipulationHandlers(props.controller, "rotate");
  useEventListener(handlers);
  const focus = useEventTarget(handlers, {
    path: cssHandlePath(state, anchor.local.x, anchor.local.y, hitSize),
    fill: true,
    cursor: "grab",
    keyboardFocusable: true,
    keyboardNavigationBounds: {
      x: anchor.local.x - 4,
      y: anchor.local.y - 4,
      width: 8,
      height: 8,
    },
  });
  const relevant = state.controller.active.get()?.operation === "rotate";
  paintRotationDecorations(ctx, state, anchor, style);
  if (readoutEnabled(style.readout, props.formatReadout || props.readoutUnit))
    paintReadout(
      ctx,
      state,
      anchor.css,
      () => formatRotation(state, props),
      style.readout,
      focus.isFocused,
      relevant,
      "top",
    );
  if (props.children !== undefined)
    return createElement(CssHandleContent, {
      style: {
        transform: cssHandleChildTransform(
          state,
          anchor.local.x,
          anchor.local.y,
        ),
      },
      children: props.children,
    });
  paintDefaultHandle(ctx, state, anchor.local.x, anchor.local.y);
});

function frameToCss(state: ManipulationState): DOMMatrix {
  const surface = state.root.surface.snapshot;
  const world = getCurrentWorldTransform();
  return surface
    ? new DOMMatrix()
        .scale(
          1 / surface.backingPixelsPerCssPixelX,
          1 / surface.backingPixelsPerCssPixelY,
        )
        .multiply(surface.renderTransform)
        .multiply(world)
    : world;
}
function cssPoint(state: ManipulationState, x: number, y: number): DOMPoint {
  return frameToCss(state).transformPoint(new DOMPoint(x, y));
}
function cssBasis(state: ManipulationState): {
  css: DOMMatrix;
  inverse: DOMMatrix;
  angle: number;
} {
  const css = frameToCss(state);
  const inverse = new DOMMatrix([css.a, css.b, css.c, css.d, 0, 0]).inverse();
  if (![inverse.a, inverse.b, inverse.c, inverse.d].every(Number.isFinite))
    throw new Error(
      "Manipulation handle cannot use a singular presentation transform.",
    );
  return { css, inverse, angle: Math.atan2(css.b, css.a) };
}
function cssHandlePath(
  state: ManipulationState,
  x: number,
  y: number,
  size: number,
): Path2D {
  const { inverse, angle } = cssBasis(state);
  const path = new Path2D();
  const half = size / 2;
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  for (const [i, point] of [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ].entries()) {
    const sx = point[0] * cos - point[1] * sin,
      sy = point[0] * sin + point[1] * cos;
    const local = inverse.transformPoint(new DOMPoint(sx, sy));
    if (i === 0) path.moveTo(x + local.x, y + local.y);
    else path.lineTo(x + local.x, y + local.y);
  }
  path.closePath();
  return path;
}
function cssHandleChildTransform(
  state: ManipulationState,
  x: number,
  y: number,
): DOMMatrix {
  const { inverse, angle } = cssBasis(state);
  const rotate = new DOMMatrix().rotate((angle * 180) / Math.PI);
  const basis = inverse.multiply(rotate);
  return new DOMMatrix([basis.a, basis.b, basis.c, basis.d, x, y]);
}
function paintDefaultHandle(
  ctx: RenderingContext2D,
  state: ManipulationState,
  x: number,
  y: number,
): void {
  ctx.fillStyle = "#2563eb";
  ctx.fill(cssHandlePath(state, x, y, 8));
  ctx.fillStyle = "#ffffff";
  ctx.fill(cssHandlePath(state, x, y, 6));
}

function rotationAnchor(
  state: ManipulationState,
  width: number,
  height: number,
) {
  const css = frameToCss(state);
  const top = css.transformPoint(new DOMPoint(width / 2, 0));
  const pivot = css.transformPoint(new DOMPoint(width / 2, height / 2));
  const edge = new DOMPoint(css.a, css.b);
  const mappedOut = new DOMPoint(-css.c, -css.d);
  let normal = new DOMPoint(-edge.y, edge.x);
  const length = Math.hypot(normal.x, normal.y);
  if (!Number.isFinite(length) || length === 0)
    throw new Error(
      "RotationHandle cannot use a singular presentation transform.",
    );
  normal = new DOMPoint(normal.x / length, normal.y / length);
  if (normal.x * mappedOut.x + normal.y * mappedOut.y < 0)
    normal = new DOMPoint(-normal.x, -normal.y);
  const handle = new DOMPoint(top.x + normal.x * 24, top.y + normal.y * 24);
  const local = css.inverse().transformPoint(handle);
  return { css: handle, local, top, pivot, normal };
}
function paintRotationDecorations(
  ctx: RenderingContext2D,
  state: ManipulationState,
  anchor: ReturnType<typeof rotationAnchor>,
  style: CRCRotationHandleStyle,
): void {
  validateRotationStyle(style);
  const connector =
    style.connector === undefined || style.connector === true
      ? {}
      : style.connector;
  const arc = style.arc === true ? {} : style.arc;
  if (connector === false && !arc) return;
  withCssContext(ctx, state, () => {
    const baseAlpha = ctx.globalAlpha;
    if (connector !== false) {
      ctx.strokeStyle = connector.stroke ?? "#2563eb";
      ctx.lineWidth = connector.strokeWidth ?? 1;
      ctx.globalAlpha *= connector.opacity ?? 1;
      ctx.beginPath();
      ctx.moveTo(anchor.top.x, anchor.top.y);
      ctx.lineTo(anchor.css.x, anchor.css.y);
      ctx.stroke();
      ctx.globalAlpha = baseAlpha;
    }
    if (arc) {
      const radius = Math.hypot(
        anchor.css.x - anchor.pivot.x,
        anchor.css.y - anchor.pivot.y,
      );
      const center = Math.atan2(
        anchor.css.y - anchor.pivot.y,
        anchor.css.x - anchor.pivot.x,
      );
      const sweep = arc.sweep ?? Math.PI / 3;
      for (let i = 0; i < 24; i++) {
        const a0 = center - sweep / 2 + (sweep * i) / 24,
          a1 = center - sweep / 2 + (sweep * (i + 1)) / 24;
        const alpha = (1 - Math.abs((i + 0.5) / 12 - 1)) * (arc.opacity ?? 1);
        ctx.strokeStyle = arc.color ?? "#2563eb";
        ctx.lineWidth = arc.strokeWidth ?? 1;
        ctx.globalAlpha = baseAlpha * alpha;
        ctx.beginPath();
        ctx.arc(anchor.pivot.x, anchor.pivot.y, radius, a0, a1);
        ctx.stroke();
      }
      ctx.globalAlpha = baseAlpha;
    }
  });
}
function validateReadoutStyle(
  value: false | true | CRCManipulationReadoutStyle | undefined,
): void {
  if (!value || value === true) return;
  for (const style of [value, value.inactive, value.focused, value.active]) {
    if (!style) continue;
    if (
      style.gap !== undefined &&
      (!Number.isFinite(style.gap) || style.gap < 0)
    )
      throw new Error(
        "Manipulation readout gap must be finite non-negative CSS pixels.",
      );
    if (
      style.strokeWidth !== undefined &&
      (!Number.isFinite(style.strokeWidth) || style.strokeWidth < 0)
    )
      throw new Error(
        "Manipulation readout strokeWidth must be finite and non-negative.",
      );
    if (
      style.opacity !== undefined &&
      (!Number.isFinite(style.opacity) || style.opacity < 0)
    )
      throw new Error(
        "Manipulation readout opacity must be finite and non-negative.",
      );
  }
}
function validateRotationStyle(style: CRCRotationHandleStyle): void {
  const connector =
    style.connector && style.connector !== true ? style.connector : undefined;
  const arc = style.arc && style.arc !== true ? style.arc : undefined;
  for (const value of [connector?.strokeWidth, arc?.strokeWidth])
    if (value !== undefined && (!Number.isFinite(value) || value < 0))
      throw new Error(
        "Manipulation guide strokeWidth must be finite and non-negative.",
      );
  for (const value of [connector?.opacity, arc?.opacity])
    if (value !== undefined && (!Number.isFinite(value) || value < 0))
      throw new Error(
        "Manipulation guide opacity must be finite and non-negative.",
      );
  if (
    arc?.sweep !== undefined &&
    (!Number.isFinite(arc.sweep) || arc.sweep <= 0 || arc.sweep > Math.PI * 2)
  )
    throw new Error(
      "Manipulation arc sweep must be finite, positive, and no greater than 2π radians.",
    );
}

function readoutEnabled(
  readout: false | true | CRCManipulationReadoutStyle | undefined,
  formatter: unknown,
): boolean {
  return (
    readout !== false && (readout !== undefined || formatter !== undefined)
  );
}
function formatResize(
  state: ManipulationState,
  format: CRCResizeHandleProps["formatReadout"],
): string {
  const box = state.options.box.get();
  const value = format
    ? format({ width: box.width, height: box.height })
    : `${round(box.width)} × ${round(box.height)} px`;
  if (typeof value !== "string")
    throw new Error("Manipulation readout formatReadout must return a string.");
  return value;
}
function formatRotation(
  state: ManipulationState,
  props: CRCRotationHandleProps,
): string {
  const rotation = state.options.rotation?.get() ?? 0;
  const value = props.formatReadout
    ? props.formatReadout({ rotation })
    : props.readoutUnit === "radians"
      ? `${round(rotation)} rad`
      : `${round((rotation * 180) / Math.PI)}°`;
  if (typeof value !== "string")
    throw new Error("Manipulation readout formatReadout must return a string.");
  return value;
}
function round(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(2)));
}
function paintReadout(
  ctx: RenderingContext2D,
  state: ManipulationState,
  anchor: DOMPoint,
  format: () => string,
  readout: false | true | CRCManipulationReadoutStyle | undefined,
  focused: boolean,
  active: boolean,
  position?: ResizePosition,
): void {
  validateReadoutStyle(readout);
  const resolved = resolveReadout(
    readout,
    state.controller.active.get() === null,
    focused,
    active,
  );
  if (!resolved.visible) return;
  const text = format();
  if (!text) return;
  const frameMapping = frameToCss(state);
  withCssContext(ctx, state, () => {
    ctx.font = resolved.font;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const surface = state.root.surface.snapshot;
    if (!surface) return;
    const stroke = resolved.stroke ? resolved.strokeWidth : 0;
    const available = surface.displayWidth - 16 - stroke;
    const value = ellipsis(ctx, text, available);
    if (!value) return;
    const metrics = measureLabel(ctx, value);
    const glyphLeft = Math.max(0, metrics.actualBoundingBoxLeft);
    const glyphRight = Math.max(metrics.width, metrics.actualBoundingBoxRight);
    const ascent = Math.max(0, metrics.actualBoundingBoxAscent);
    const descent = Math.max(0, metrics.actualBoundingBoxDescent);
    const height = ascent + descent + 6 + stroke;
    const width = glyphLeft + glyphRight + 8 + stroke;
    if (width > surface.displayWidth - 8 || height > surface.displayHeight - 8)
      return;
    const offset = outwardReadoutOffset(
      frameMapping,
      position,
      width,
      height,
      resolved.gap,
    );
    let left = anchor.x + offset.x - width / 2;
    let top = anchor.y + offset.y - height / 2;
    left = Math.max(4, Math.min(surface.displayWidth - 4 - width, left));
    top = Math.max(4, Math.min(surface.displayHeight - 4 - height, top));
    ctx.globalAlpha *= resolved.opacity;
    ctx.fillStyle = resolved.fill;
    if (resolved.stroke) {
      ctx.strokeStyle = resolved.stroke;
      ctx.lineWidth = resolved.strokeWidth;
      ctx.strokeText(
        value,
        left + 4 + glyphLeft + stroke / 2,
        top + 3 + ascent + stroke / 2,
      );
    }
    ctx.fillText(
      value,
      left + 4 + glyphLeft + stroke / 2,
      top + 3 + ascent + stroke / 2,
    );
  });
}
/** Separate the upright label from the selected edges in displayed CSS space. */
function outwardReadoutOffset(
  frameMapping: DOMMatrix,
  position: ResizePosition | undefined,
  width: number,
  height: number,
  gap: number,
): DOMPoint {
  if (!position) return new DOMPoint(width / 2 + gap, 0);
  const inverse = frameMapping.inverse();
  const normals: DOMPoint[] = [];
  const add = (x: number, y: number, sign: number) => {
    const length = Math.hypot(x, y);
    normals.push(new DOMPoint((sign * x) / length, (sign * y) / length));
  };
  if (position.includes("left")) add(inverse.a, inverse.c, -1);
  if (position.includes("right")) add(inverse.a, inverse.c, 1);
  if (position.includes("top")) add(inverse.b, inverse.d, -1);
  if (position.includes("bottom")) add(inverse.b, inverse.d, 1);
  const support = (n: DOMPoint) =>
    (Math.abs(n.x) * width) / 2 + (Math.abs(n.y) * height) / 2 + gap;
  const [a, b] = normals;
  const da = support(a);
  if (!b) return new DOMPoint(a.x * da, a.y * da);
  const db = support(b),
    determinant = a.x * b.y - a.y * b.x;
  return new DOMPoint(
    (da * b.y - a.y * db) / determinant,
    (a.x * db - da * b.x) / determinant,
  );
}
function resolveReadout(
  value: false | true | CRCManipulationReadoutStyle | undefined,
  inactive: boolean,
  focused: boolean,
  active: boolean,
): Required<CRCManipulationReadoutStateStyle> {
  const source = value && value !== true ? value : {};
  const base: Required<CRCManipulationReadoutStateStyle> = {
    gap: source.gap ?? 5,
    font: source.font ?? "12px sans-serif",
    fill: source.fill ?? "#1d4ed8",
    stroke: source.stroke ?? "",
    strokeWidth: source.strokeWidth ?? 0,
    opacity: source.opacity ?? 1,
    visible: source.visible ?? false,
  };
  const patch = (next: CRCManipulationReadoutStateStyle | undefined) => {
    if (next) Object.assign(base, next);
  };
  if (inactive) patch(source.inactive);
  if (focused) patch(source.focused);
  if (active) (patch({ visible: true }), patch(source.active));
  return base;
}
const labelMeasurements = new WeakMap<
  RenderingContext2D,
  Map<string, TextMetrics>
>();
function measureLabel(ctx: RenderingContext2D, text: string): TextMetrics {
  let cache = labelMeasurements.get(ctx);
  if (!cache) labelMeasurements.set(ctx, (cache = new Map()));
  const key = JSON.stringify([
    ctx.font,
    ctx.direction,
    ctx.fontKerning,
    ctx.letterSpacing,
    ctx.wordSpacing,
    text,
  ]);
  const found = cache.get(key);
  if (found) return found;
  const result = ctx.measureText(text);
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}
function ellipsis(
  ctx: RenderingContext2D,
  text: string,
  width: number,
): string {
  const fits = (value: string) => {
    const m = measureLabel(ctx, value);
    return (
      Math.max(0, m.actualBoundingBoxLeft) +
        Math.max(m.width, m.actualBoundingBoxRight) <=
      width
    );
  };
  if (width <= 0) return "";
  if (fits(text)) return text;
  const suffix = "…";
  if (!fits(suffix)) return "";
  const points = Array.from(text);
  let low = 0,
    high = points.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(points.slice(0, mid).join("") + suffix)) low = mid;
    else high = mid - 1;
  }
  return points.slice(0, low).join("") + suffix;
}
function withCssContext(
  ctx: RenderingContext2D,
  state: ManipulationState,
  draw: () => void,
): void {
  const surface = state.root.surface.snapshot;
  if (!surface) return;
  const cssToCurrent = ctx.getTransform().multiply(frameToCss(state).inverse());
  ctx.save();
  try {
    ctx.setTransform(cssToCurrent);
    ctx.beginPath();
    ctx.rect(0, 0, surface.displayWidth, surface.displayHeight);
    ctx.clip();
    draw();
  } finally {
    ctx.restore();
  }
}
