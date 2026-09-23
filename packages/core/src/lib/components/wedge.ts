import { definePrimitive } from "../define-primitive.js";
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
  CRCEventParticipationOptions,
} from "../events/types.js";
import {
  resolveLocalOffset,
  stripLayoutParticipation,
} from "../style/resolve-built-in.js";
import { registerOpaqueStyleProperties } from "../style/resolve-dispatch.js";
import type {
  BoxStyle,
  CursorStyle,
  LayoutItemStyle,
  Length,
  PaintStyle,
  ResolvedDrawingStyle,
} from "../style/types.js";
import type { RenderingContext2D, SystemStyle } from "../types.js";
import type { CRCPhysics2DPropExtension } from "../types.js";
import { wedgeBounds } from "./arc-geometry.js";
import {
  createWedgePath,
  resolveCircularSweep,
} from "../geometry/circular-sweep.js";
import { renderPath } from "./path.js";
import {
  circularPercentageBasis,
  resolveFiniteShapeNumber,
  resolveNonnegativeShapeLength,
} from "./shape-style.js";

export interface WedgeProps extends CRCEventHandlers, CRCEventFocusOptions, CRCEventParticipationOptions, CRCPhysics2DPropExtension {}

export interface WedgeStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  radius: Exclude<Length, "auto">;
  startAngle: number;
  endAngle: number;
  cx?: Exclude<Length, "auto">;
  cy?: Exclude<Length, "auto">;
  counterclockwise?: boolean;
  lineInteractionWidth?: number;
}

type ResolvedWedgeStyle = ResolvedDrawingStyle<WedgeStyle> & {
  radius: number;
  startAngle: number;
  endAngle: number;
  cx: number;
  cy: number;
  counterclockwise: boolean;
};

function renderWedge(
  props: WedgeProps,
  style: Readonly<ResolvedWedgeStyle>,
  ctx: RenderingContext2D,
) {
  const {
    cx,
    cy,
    radius,
    startAngle,
    endAngle,
    counterclockwise,
    fill,
    stroke,
    strokeWidth,
    opacity,
    cursor,
    lineInteractionWidth,
  } = style;
  const sweep = resolveCircularSweep(startAngle, endAngle, counterclockwise);
  const path = createWedgePath({
    cx,
    cy,
    radius,
    startAngle,
    endAngle,
    counterclockwise,
  });

  return renderPath(
    {
      ...props,
      keyboardNavigationBounds:
        props.keyboardNavigationBounds ?? wedgeBounds(cx, cy, radius, sweep),
    },
    {
      d: path,
      fill,
      stroke,
      strokeWidth,
      opacity,
      cursor,
      lineInteractionWidth,
    },
    ctx,
  );
}

/** Describes a center-closed circular wedge primitive for JSX or createElement authoring. */
export const Wedge = definePrimitive<
  WedgeProps,
  WedgeStyle,
  WedgeStyle,
  ResolvedWedgeStyle
>(renderWedge, {
  resolveStyle: (style, context) =>
    ({
      ...stripLayoutParticipation(style),
      cx: resolveLocalOffset(
        style.cx,
        context.percentageBasis.width,
        "cx",
        context,
      ),
      cy: resolveLocalOffset(
        style.cy,
        context.percentageBasis.height,
        "cy",
        context,
      ),
      radius: resolveNonnegativeShapeLength(
        style.radius,
        circularPercentageBasis(context),
        "radius",
        context,
      ),
      startAngle: resolveFiniteShapeNumber(
        style.startAngle,
        "startAngle",
        context,
      ),
      endAngle: resolveFiniteShapeNumber(style.endAngle, "endAngle", context),
      counterclockwise: style.counterclockwise ?? false,
    }) as ResolvedWedgeStyle,
});
registerOpaqueStyleProperties(Wedge, ["fill", "stroke", "cursor"]);
