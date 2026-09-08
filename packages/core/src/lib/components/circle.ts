import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
} from '../events/types.js';
import type { RenderingContext2D, SystemStyle } from '../types.js';
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

export interface CircleProps extends CRCEventHandlers, CRCEventFocusOptions {}

export interface CircleStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  radius: Exclude<Length, 'auto'>;
  cx?: Exclude<Length, 'auto'>;
  cy?: Exclude<Length, 'auto'>;
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

/** Describes a circle primitive for JSX or createElement authoring. */
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
