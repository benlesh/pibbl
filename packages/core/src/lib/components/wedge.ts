import { definePrimitive } from "../define-primitive.js";
import type {
  PibblEventFocusOptions,
  PibblEventHandlers,
  PibblEventParticipationOptions,
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
import type { PibblPhysics2DPropExtension } from "../types.js";
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

/**
 * Authored inputs for Wedge, including the declared data and presentation options.
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblEventParticipationOptions}
 * @see {@link PibblPhysics2DPropExtension}
 * @see {@link Wedge}
 */
export interface WedgeProps extends PibblEventHandlers, PibblEventFocusOptions, PibblEventParticipationOptions, PibblPhysics2DPropExtension {}

/**
 * Supported geometry and presentation properties for Wedge.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link Length}
 * @see {@link Wedge}
 */
export interface WedgeStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  /** Radius in the coordinate system of this geometry or effect. See {@link Length}. */
  radius: Exclude<Length, "auto">;
  /** Angle at which the arc or slice begins. See {@link WedgeStyle}. */
  startAngle: number;
  /** Angle at which the arc or slice ends. See {@link WedgeStyle}. */
  endAngle: number;
  /** Horizontal coordinate of the center. See {@link Length}. */
  cx?: Exclude<Length, "auto">;
  /** Vertical coordinate of the center. See {@link Length}. */
  cy?: Exclude<Length, "auto">;
  /** Whether the arc follows the counterclockwise direction. See {@link WedgeStyle}. */
  counterclockwise?: boolean;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link WedgeStyle}.
   */
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

/**
 * Describes a center-closed circular wedge primitive for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link WedgeProps}
 * @see {@link WedgeStyle}
 */
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
