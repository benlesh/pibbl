import { createElement } from "../element/create-element.js";
import { Group } from "../components/g.js";
import { getCurrentWorldTransform } from "../render-target.js";
import { definePrimitive } from "../define-primitive.js";
import { useEventListener } from "../hooks/use-event-listener.js";
import { useEventTarget } from "../hooks/use-event-target.js";
import { getLayoutBox } from "../layout/context.js";
import { resolveLength } from "../style/resolve-length.js";
import type { CRCNode } from "../element/types.js";
import type { BoxStyle, LayoutItemStyle } from "../style/types.js";
import type { SystemStyle } from "../types.js";
import type { CRCManipulationController } from "./controller-types.js";
import { manipulationHandlers } from "./controller.js";
import { requireManipulationFrame } from "./frame.js";

export interface CRCDragHandleProps {
  readonly controller: CRCManipulationController;
  readonly children?: CRCNode;
}
export interface CRCDragHandleStyle extends BoxStyle, LayoutItemStyle {
  cursor?: string;
}
interface ResolvedDragStyle extends SystemStyle {
  width: number;
  height: number;
  cursor?: string;
}
export const DragHandle = definePrimitive<
  CRCDragHandleProps,
  CRCDragHandleStyle,
  CRCDragHandleStyle,
  ResolvedDragStyle
>(
  function DragHandle(props, style) {
    requireManipulationFrame(props.controller);
    const path = new Path2D();
    path.rect(0, 0, style.width, style.height);
    const handlers = manipulationHandlers(props.controller, "move");
    useEventListener(handlers);
    useEventTarget(handlers, {
      path,
      fill: true,
      cursor: style.cursor ?? "grab",
      keyboardFocusable: true,
      keyboardNavigationBounds: {
        x: 0,
        y: 0,
        width: style.width,
        height: style.height,
      },
    });
    return props.children;
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
      };
    },
  },
);

export interface CRCResizeHandleProps {
  readonly controller: CRCManipulationController;
  readonly position: import("./types.js").CRCResizePosition;
  readonly hitSize?: number;
  readonly children?: CRCNode;
}
export interface CRCResizeHandlesProps {
  readonly controller: CRCManipulationController;
  readonly positions?:
    | "corners"
    | "edges-and-corners"
    | readonly import("./types.js").CRCResizePosition[];
  readonly hitSize?: number;
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
export const ResizeHandle = definePrimitive<CRCResizeHandleProps>(
  function ResizeHandle(props, _style, ctx) {
    const state = requireManipulationFrame(props.controller);
    const box = getLayoutBox();
    const position = props.position;
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
      throw new Error(
        "ResizeHandle hitSize must be positive finite CSS pixels.",
      );
    const hit = cssHandlePath(state, x, y, hitSize);
    useEventTarget(manipulationHandlers(props.controller, "resize", position), {
      path: hit,
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
    if (props.children !== undefined)
      return createElement(Group, {
        style: { translateX: x, translateY: y },
        children: props.children,
      });
    const visual = cssHandlePath(state, x, y, 8);
    ctx.fillStyle = "#ffffff";
    ctx.fill(visual);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1;
    ctx.stroke(visual);
  },
);
export function ResizeHandles(props: CRCResizeHandlesProps): CRCNode {
  const positions =
    props.positions === undefined || props.positions === "corners"
      ? corners
      : props.positions === "edges-and-corners"
        ? allHandles
        : props.positions;
  return positions.map((position) =>
    createElement(ResizeHandle, {
      key: position,
      controller: props.controller,
      position,
      hitSize: props.hitSize,
    }),
  );
}

function frameToCss(
  state: import("./controller.js").ManipulationState,
): DOMMatrix {
  const surface = state.root.surface.snapshot;
  const world = getCurrentWorldTransform();
  const css = surface
    ? new DOMMatrix()
        .scale(
          1 / surface.backingPixelsPerCssPixelX,
          1 / surface.backingPixelsPerCssPixelY,
        )
        .multiply(surface.renderTransform)
        .multiply(world)
    : world;
  return css;
}

function cssHandlePath(
  state: import("./controller.js").ManipulationState,
  x: number,
  y: number,
  size: number,
): Path2D {
  const css = frameToCss(state);
  const inverse = new DOMMatrix([css.a, css.b, css.c, css.d, 0, 0]).inverse();
  if (![inverse.a, inverse.b, inverse.c, inverse.d].every(Number.isFinite))
    throw new Error(
      "Manipulation handle cannot use a singular presentation transform.",
    );
  const path = new Path2D();
  const half = size / 2;
  for (const [index, point] of [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ].entries()) {
    const local = inverse.transformPoint(new DOMPoint(point[0], point[1]));
    if (index === 0) path.moveTo(x + local.x, y + local.y);
    else path.lineTo(x + local.x, y + local.y);
  }
  path.closePath();
  return path;
}

export interface CRCRotationHandleProps {
  readonly controller: CRCManipulationController;
  readonly hitSize?: number;
  readonly children?: CRCNode;
}
export const RotationHandle = definePrimitive<CRCRotationHandleProps>(
  function RotationHandle(props, _style, ctx) {
    const state = requireManipulationFrame(props.controller);
    const box = getLayoutBox();
    const css = frameToCss(state);
    const scale = Math.hypot(css.c, css.d);
    if (!Number.isFinite(scale) || scale === 0)
      throw new Error(
        "RotationHandle cannot use a singular presentation transform.",
      );
    const x = box.width / 2;
    const y = -24 / scale;
    const hitSize = props.hitSize ?? 24;
    if (!Number.isFinite(hitSize) || hitSize <= 0)
      throw new Error(
        "RotationHandle hitSize must be positive finite CSS pixels.",
      );
    useEventTarget(manipulationHandlers(props.controller, "rotate"), {
      path: cssHandlePath(state, x, y, hitSize),
      fill: true,
      cursor: "grab",
      keyboardFocusable: true,
      keyboardNavigationBounds: { x: x - 4, y: y - 4, width: 8, height: 8 },
    });
    if (props.children !== undefined)
      return createElement(Group, {
        style: { translateX: x, translateY: y },
        children: props.children,
      });
    ctx.fillStyle = "#ffffff";
    ctx.fill(cssHandlePath(state, x, y, 8));
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1;
    ctx.stroke(cssHandlePath(state, x, y, 8));
  },
);
