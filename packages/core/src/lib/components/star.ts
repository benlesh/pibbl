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

/**
 * Authored inputs for Star, including the declared data and presentation options.
 *
 * @see {@link CRCEventHandlers}
 * @see {@link CRCEventParticipationOptions}
 * @see {@link CRCPhysics2DPropExtension}
 * @see {@link Star}
 */
export interface StarProps extends CRCEventHandlers, CRCEventFocusOptions, CRCEventParticipationOptions, CRCPhysics2DPropExtension {}

/**
 * Supported geometry and presentation properties for Star.
 *
 * @see {@link RoundedCornerStyle}
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link Length}
 * @see {@link Star}
 */
export interface StarStyle
  extends
    RoundedCornerStyle,
    SystemStyle,
    PaintStyle,
    CursorStyle,
    BoxStyle,
    LayoutItemStyle {
  /** Points defining the geometry or reported by the contact query. See {@link StarStyle}. */
  points: number;
  /** Horizontal coordinate of the center. See {@link Length}. */
  cx?: Exclude<Length, 'auto'>;
  /** Vertical coordinate of the center. See {@link Length}. */
  cy?: Exclude<Length, 'auto'>;
  /** Radius of the outer boundary. See {@link Length}. */
  outerRadius: Exclude<Length, 'auto'>;
  /** Radius of the inner boundary. See {@link Length}. */
  innerRadius: Exclude<Length, 'auto'>;
  /** Rotation applied to the containing geometry. See {@link StarStyle}. */
  rotation?: number;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link StarStyle}.
   */
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

/**
 * Describes a star primitive for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; CRC mounts this component through JSX or createElement.
 *
 * @see {@link StarProps}
 * @see {@link StarStyle}
 */
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
