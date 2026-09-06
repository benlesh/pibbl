import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
} from '../events/types.js';
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
import type { RenderingContext2D, SystemStyle } from '../types.js';
import {
  arcBounds,
  createArcPath,
  resolveCircularSweep,
} from './arc-geometry.js';
import { renderPath } from './path.js';
import {
  circularPercentageBasis,
  resolveFiniteShapeNumber,
  resolveNonnegativeShapeLength,
} from './shape-style.js';

export interface ArcProps extends CRCEventHandlers, CRCEventFocusOptions {}

export interface ArcStyle
  extends SystemStyle,
    Omit<PaintStyle, 'fill'>,
    CursorStyle,
    BoxStyle,
    LayoutItemStyle {
  radius: Exclude<Length, 'auto'>;
  startAngle: number;
  endAngle: number;
  cx?: Exclude<Length, 'auto'>;
  cy?: Exclude<Length, 'auto'>;
  counterclockwise?: boolean;
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
  const path = createArcPath(cx, cy, radius, sweep);

  return renderPath({
    ...props,
    keyboardNavigationBounds: props.keyboardNavigationBounds ??
      arcBounds(cx, cy, radius, sweep),
  }, {
    d: path,
    stroke,
    strokeWidth,
    opacity,
    cursor,
    lineInteractionWidth,
  }, ctx);
}

/** Describes an open circular arc primitive for JSX or createElement authoring. */
export const Arc = definePrimitive<
  ArcProps,
  ArcStyle,
  ArcStyle,
  ResolvedArcStyle
>(renderArc, {
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
    startAngle: resolveFiniteShapeNumber(
      style.startAngle,
      'startAngle',
      context,
    ),
    endAngle: resolveFiniteShapeNumber(style.endAngle, 'endAngle', context),
    counterclockwise: style.counterclockwise ?? false,
  }) as ResolvedArcStyle,
});
registerOpaqueStyleProperties(Arc, ['stroke', 'cursor']);
