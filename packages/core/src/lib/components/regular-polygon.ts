import { definePrimitive } from '../define-primitive.js';
import type {
  PibblEventFocusOptions,
  PibblEventHandlers,
  PibblEventParticipationOptions,
} from '../events/types.js';
import {
  resolveRegularPolygonGeometry,
  type RegularPolygonPathOptions,
} from '../geometry/regular-polygon.js';
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
import type { PibblPhysics2DPropExtension } from '../types.js';
import { renderPath } from './path.js';
import { resolveRoundedCornerStyle } from './rounded-corner-style.js';
import {
  circularPercentageBasis,
  resolveFiniteShapeNumber,
  resolveNonnegativeShapeLength,
  shapeGeometryErrorFactory,
} from './shape-style.js';

/**
 * Authored inputs for RegularPolygon, including the declared data and presentation options.
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblEventParticipationOptions}
 * @see {@link PibblPhysics2DPropExtension}
 * @see {@link RegularPolygon}
 */
export interface RegularPolygonProps
  extends PibblEventHandlers, PibblEventFocusOptions, PibblEventParticipationOptions, PibblPhysics2DPropExtension {}

/**
 * Center, side count, rotation, and paint shared by regular-polygon size variants.
 *
 * @see {@link RegularPolygonStyle}
 */
interface RegularPolygonCommonStyle extends RoundedCornerStyle {
  /** Number of sides of the regular polygon. See {@link RegularPolygonCommonStyle}. */
  sides: number;
  /** Horizontal coordinate of the center. See {@link Length}. */
  cx?: Exclude<Length, 'auto'>;
  /** Vertical coordinate of the center. See {@link Length}. */
  cy?: Exclude<Length, 'auto'>;
  /** Rotation applied to the containing geometry. See {@link RegularPolygonCommonStyle}. */
  rotation?: number;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link RegularPolygonCommonStyle}.
   */
  lineInteractionWidth?: number;
}

/**
 * Exactly one declared size measure for a regular polygon.
 *
 * @see {@link RegularPolygonStyle}
 */
type RegularPolygonSizeStyle =
  | {
      /** Distance from the polygon center to a vertex. See {@link Length}. */
      circumradius: Exclude<Length, 'auto'>;
      /**
       * Not accepted in this variant; use the alternative fields instead. See
       * {@link RegularPolygonSizeStyle}.
       */
      inradius?: never;
      /**
       * Not accepted in this variant; use the alternative fields instead. See
       * {@link RegularPolygonSizeStyle}.
       */
      sideLength?: never;
    }
  | {
      /**
       * Not accepted in this variant; use the alternative fields instead. See
       * {@link RegularPolygonSizeStyle}.
       */
      circumradius?: never;
      /** Distance from the polygon center to an edge. See {@link Length}. */
      inradius: Exclude<Length, 'auto'>;
      /**
       * Not accepted in this variant; use the alternative fields instead. See
       * {@link RegularPolygonSizeStyle}.
       */
      sideLength?: never;
    }
  | {
      /**
       * Not accepted in this variant; use the alternative fields instead. See
       * {@link RegularPolygonSizeStyle}.
       */
      circumradius?: never;
      /**
       * Not accepted in this variant; use the alternative fields instead. See
       * {@link RegularPolygonSizeStyle}.
       */
      inradius?: never;
      /** Length of one polygon edge. See {@link Length}. */
      sideLength: Exclude<Length, 'auto'>;
    };

/**
 * Supported geometry and presentation properties for RegularPolygon.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link RegularPolygon}
 */
export type RegularPolygonStyle = RegularPolygonCommonStyle &
  RegularPolygonSizeStyle &
  SystemStyle &
  PaintStyle &
  CursorStyle &
  BoxStyle &
  LayoutItemStyle;

interface ResolvedRegularPolygonStyle
  extends SystemStyle, PaintStyle, CursorStyle {
  sides: number;
  cx: number;
  cy: number;
  rotation: number;
  circumradius?: number;
  inradius?: number;
  sideLength?: number;
  cornerRadius?: number;
  cornerRadii?: readonly (number | null | undefined)[];
  lineInteractionWidth?: number;
  geometryErrorFactory: GeometryErrorFactory;
}

function renderRegularPolygon(
  props: RegularPolygonProps,
  style: Readonly<ResolvedRegularPolygonStyle>,
  ctx: RenderingContext2D,
) {
  const {
    sides,
    cx,
    cy,
    rotation,
    circumradius,
    inradius,
    sideLength,
    cornerRadius,
    cornerRadii,
    geometryErrorFactory,
    ...pathStyle
  } = style;
  const geometry = resolveRegularPolygonGeometry({
    sides,
    cx,
    cy,
    rotation,
    ...(circumradius === undefined ? {} : { circumradius }),
    ...(inradius === undefined ? {} : { inradius }),
    ...(sideLength === undefined ? {} : { sideLength }),
    cornerRadius,
    cornerRadii,
  } as RegularPolygonPathOptions, geometryErrorFactory);

  return renderPath({
    ...props,
    keyboardNavigationBounds: props.keyboardNavigationBounds ?? geometry.bounds,
  }, {
    ...pathStyle,
    d: geometry.path,
  }, ctx);
}

/**
 * Describes a regular-polygon primitive for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link RegularPolygonProps}
 * @see {@link RegularPolygonStyle}
 */
export const RegularPolygon = definePrimitive<
  RegularPolygonProps,
  RegularPolygonStyle,
  RegularPolygonStyle,
  ResolvedRegularPolygonStyle
>(renderRegularPolygon, {
  resolveStyle: (style, context) => {
    const errorFactory = shapeGeometryErrorFactory(context);
    const sides = integerAtLeast(style.sides, 3, 'sides', errorFactory);
    const basis = circularPercentageBasis(context);
    return {
      ...stripLayoutParticipation(style),
      sides,
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
      rotation: resolveFiniteShapeNumber(
        style.rotation ?? -Math.PI / 2,
        'rotation',
        context,
      ),
      ...(style.circumradius === undefined ? {} : {
        circumradius: resolveNonnegativeShapeLength(
          style.circumradius,
          basis,
          'circumradius',
          context,
        ),
      }),
      ...(style.inradius === undefined ? {} : {
        inradius: resolveNonnegativeShapeLength(
          style.inradius,
          basis,
          'inradius',
          context,
        ),
      }),
      ...(style.sideLength === undefined ? {} : {
        sideLength: resolveNonnegativeShapeLength(
          style.sideLength,
          basis,
          'sideLength',
          context,
        ),
      }),
      ...resolveRoundedCornerStyle(sides, style, context),
      geometryErrorFactory: errorFactory,
    } as ResolvedRegularPolygonStyle;
  },
});
registerOpaqueStyleProperties(RegularPolygon, ['fill', 'stroke', 'cursor']);
