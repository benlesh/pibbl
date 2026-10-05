import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
  CRCEventParticipationOptions,
} from '../events/types.js';
import type { RenderingContext2D, SystemStyle } from '../types.js';
import type { CRCPhysics2DPropExtension } from '../types.js';
import {
  resolveLocalOffset,
  stripLayoutParticipation,
} from '../style/resolve-built-in.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type {
  BoxStyle,
  CursorStyle,
  LayoutItemStyle,
  Length,
  PaintStyle,
  ResolvedDrawingStyle,
} from '../style/types.js';
import {
  circularPercentageBasis,
  resolveNonnegativeShapeLength,
} from './shape-style.js';
import { renderPath } from './path.js';
import { createCirclePath } from '../geometry/circle.js';

/**
 * Authored inputs for Circle, including the declared data and presentation options.
 *
 * @see {@link CRCEventHandlers}
 * @see {@link CRCEventParticipationOptions}
 * @see {@link CRCPhysics2DPropExtension}
 * @see {@link Circle}
 */
export interface CircleProps extends CRCEventHandlers, CRCEventFocusOptions, CRCEventParticipationOptions, CRCPhysics2DPropExtension {}

/**
 * Supported geometry and presentation properties for Circle.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link Length}
 * @see {@link Circle}
 */
export interface CircleStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  /** Radius in the coordinate system of this geometry or effect. See {@link Length}. */
  radius: Exclude<Length, 'auto'>;
  /** Horizontal coordinate of the center. See {@link Length}. */
  cx?: Exclude<Length, 'auto'>;
  /** Vertical coordinate of the center. See {@link Length}. */
  cy?: Exclude<Length, 'auto'>;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link CircleStyle}.
   */
  lineInteractionWidth?: number;
}

type ResolvedCircleStyle = ResolvedDrawingStyle<CircleStyle> & {
  radius: number;
  cx: number;
  cy: number;
};

function renderCircle(
  props: CircleProps,
  style: Readonly<ResolvedCircleStyle>,
  ctx: RenderingContext2D,
) {
  const { cx, cy, radius, ...pathStyle } = style;
  const path = createCirclePath({ cx, cy, radius });

  return renderPath({
    ...props,
    keyboardNavigationBounds: props.keyboardNavigationBounds ?? {
      x: cx - radius,
      y: cy - radius,
      width: radius * 2,
      height: radius * 2,
    },
  }, {
    ...pathStyle,
    d: path,
  }, ctx);
}

/**
 * Describes a circle primitive for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; CRC mounts this component through JSX or createElement.
 *
 * @see {@link CircleProps}
 * @see {@link CircleStyle}
 */
export const Circle = definePrimitive<
  CircleProps,
  CircleStyle,
  CircleStyle,
  ResolvedCircleStyle
>(renderCircle, {
  resolveStyle: (style, context) => ({
    ...stripLayoutParticipation(style),
    cx: resolveLocalOffset(style.cx, context.percentageBasis.width, 'cx', context),
    cy: resolveLocalOffset(style.cy, context.percentageBasis.height, 'cy', context),
    radius: resolveNonnegativeShapeLength(
      style.radius,
      circularPercentageBasis(context),
      'radius',
      context,
    ),
  }) as ResolvedCircleStyle,
});
registerOpaqueStyleProperties(Circle, ['fill', 'stroke', 'cursor']);
