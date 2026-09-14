import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
  CRCEventParticipationOptions,
} from '../events/types.js';
import {
  resolveStarGeometry,
  type StarPathOptions,
} from '../geometry/star.js';
import {
  integerAtLeast,
  type GeometryErrorFactory,
} from '../geometry/validation.js';
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
  RoundedCornerStyle,
} from '../style/types.js';
import type { RenderingContext2D, SystemStyle } from '../types.js';
import type { CRCPhysics2DPropExtension } from '../types.js';
import { renderPath } from './path.js';
import { resolveRoundedCornerStyle } from './rounded-corner-style.js';
import {
  circularPercentageBasis,
  resolveFiniteShapeNumber,
  resolveNonnegativeShapeLength,
  shapeGeometryErrorFactory,
} from './shape-style.js';

export interface StarProps extends CRCEventHandlers, CRCEventFocusOptions, CRCEventParticipationOptions, CRCPhysics2DPropExtension {}

export interface StarStyle
  extends
    RoundedCornerStyle,
    SystemStyle,
    PaintStyle,
    CursorStyle,
    BoxStyle,
    LayoutItemStyle {
  points: number;
  cx?: Exclude<Length, 'auto'>;
  cy?: Exclude<Length, 'auto'>;
  outerRadius: Exclude<Length, 'auto'>;
  innerRadius: Exclude<Length, 'auto'>;
  rotation?: number;
  lineInteractionWidth?: number;
}

interface ResolvedStarStyle extends SystemStyle, PaintStyle, CursorStyle {
  points: number;
  cx: number;
  cy: number;
  outerRadius: number;
  innerRadius: number;
  rotation: number;
  cornerRadius?: number;
  cornerRadii?: readonly (number | null | undefined)[];
  lineInteractionWidth?: number;
  geometryErrorFactory: GeometryErrorFactory;
}

function renderStar(
  props: StarProps,
  style: Readonly<ResolvedStarStyle>,
  ctx: RenderingContext2D,
) {
  const {
    points,
    cx,
    cy,
    outerRadius,
    innerRadius,
    rotation,
    cornerRadius,
    cornerRadii,
    geometryErrorFactory,
    ...pathStyle
  } = style;
  const geometry = resolveStarGeometry({
    points,
    cx,
    cy,
    outerRadius,
    innerRadius,
    rotation,
    cornerRadius,
    cornerRadii,
  } satisfies StarPathOptions, geometryErrorFactory);

  return renderPath({
    ...props,
    keyboardNavigationBounds: props.keyboardNavigationBounds ?? geometry.bounds,
  }, {
    ...pathStyle,
    d: geometry.path,
  }, ctx);
}

/** Describes a star primitive for JSX or createElement authoring. */
export const Star = definePrimitive<
  StarProps,
  StarStyle,
  StarStyle,
  ResolvedStarStyle
>(renderStar, {
  resolveStyle: (style, context) => {
    const errorFactory = shapeGeometryErrorFactory(context);
    const points = integerAtLeast(style.points, 3, 'points', errorFactory);
    const basis = circularPercentageBasis(context);
    return {
      ...stripLayoutParticipation(style),
      points,
      cx: resolveLocalOffset(
        style.cx,
        context.percentageBasis.width,
        'cx',
        context,
      ),
      cy: resolveLocalOffset(
        style.cy,
        context.percentageBasis.height,
        'cy',
        context,
      ),
      outerRadius: resolveNonnegativeShapeLength(
        style.outerRadius,
        basis,
        'outerRadius',
        context,
      ),
      innerRadius: resolveNonnegativeShapeLength(
        style.innerRadius,
        basis,
        'innerRadius',
        context,
      ),
      rotation: resolveFiniteShapeNumber(
        style.rotation ?? -Math.PI / 2,
        'rotation',
        context,
      ),
      ...resolveRoundedCornerStyle(points * 2, style, context),
      geometryErrorFactory: errorFactory,
    };
  },
});
registerOpaqueStyleProperties(Star, ['fill', 'stroke', 'cursor']);
