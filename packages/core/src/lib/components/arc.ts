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
import { arcBounds } from "./arc-geometry.js";
import {
  createArcPath,
  resolveCircularSweep,
} from "../geometry/circular-sweep.js";
import { renderPath } from "./path.js";
import {
  circularPercentageBasis,
  resolveFiniteShapeNumber,
  resolveNonnegativeShapeLength,
} from "./shape-style.js";

/**
 * Authored inputs for Arc, including the declared data and presentation options.
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblEventParticipationOptions}
 * @see {@link PibblPhysics2DPropExtension}
 * @see {@link Arc}
 */
export interface ArcProps extends PibblEventHandlers, PibblEventFocusOptions, PibblEventParticipationOptions, PibblPhysics2DPropExtension {}

/**
 * Supported geometry and presentation properties for Arc.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link Length}
 * @see {@link Arc}
 */
export interface ArcStyle
  extends SystemStyle, Omit<PaintStyle, "fill">, CursorStyle, BoxStyle, LayoutItemStyle {
  /** Radius in the coordinate system of this geometry or effect. See {@link Length}. */
  radius: Exclude<Length, "auto">;
  /** Angle at which the arc or slice begins. See {@link ArcStyle}. */
  startAngle: number;
  /** Angle at which the arc or slice ends. See {@link ArcStyle}. */
  endAngle: number;
  /** Horizontal coordinate of the center. See {@link Length}. */
  cx?: Exclude<Length, "auto">;
  /** Vertical coordinate of the center. See {@link Length}. */
  cy?: Exclude<Length, "auto">;
  /** Whether the arc follows the counterclockwise direction. See {@link ArcStyle}. */
  counterclockwise?: boolean;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link ArcStyle}.
   */
  lineInteractionWidth?: number;
}

type ResolvedArcStyle = ResolvedDrawingStyle<ArcStyle> & {
  radius: number;
  startAngle: number;
  endAngle: number;
  cx: number;
  cy: number;
  counterclockwise: boolean;
};

function renderArc(
  props: ArcProps,
  style: Readonly<ResolvedArcStyle>,
  ctx: RenderingContext2D,
) {
  const {
    cx,
    cy,
    radius,
    startAngle,
    endAngle,
    counterclockwise,
    stroke,
    strokeWidth,
    opacity,
    cursor,
    lineInteractionWidth,
  } = style;
  const sweep = resolveCircularSweep(startAngle, endAngle, counterclockwise);
  const path = createArcPath({
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
        props.keyboardNavigationBounds ?? arcBounds(cx, cy, radius, sweep),
    },
    {
      d: path,
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
 * Describes an open circular arc primitive for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link ArcProps}
 * @see {@link ArcStyle}
 */
export const Arc = definePrimitive<
  ArcProps,
  ArcStyle,
  ArcStyle,
  ResolvedArcStyle
>(renderArc, {
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
    }) as ResolvedArcStyle,
});
registerOpaqueStyleProperties(Arc, ["stroke", "cursor"]);
