import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
  CRCEventParticipationOptions,
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
import { renderPath } from './path.js';
import { resolveRoundedCornerStyle } from './rounded-corner-style.js';
import {
  circularPercentageBasis,
  resolveFiniteShapeNumber,
  resolveNonnegativeShapeLength,
  shapeGeometryErrorFactory,
} from './shape-style.js';

export interface RegularPolygonProps
  extends CRCEventHandlers, CRCEventFocusOptions, CRCEventParticipationOptions {}

interface RegularPolygonCommonStyle extends RoundedCornerStyle {
  sides: number;
  cx?: Exclude<Length, 'auto'>;
  cy?: Exclude<Length, 'auto'>;
  rotation?: number;
  lineInteractionWidth?: number;
}

type RegularPolygonSizeStyle =
  | {
      circumradius: Exclude<Length, 'auto'>;
      inradius?: never;
      sideLength?: never;
    }
  | {
      circumradius?: never;
      inradius: Exclude<Length, 'auto'>;
      sideLength?: never;
    }
  | {
      circumradius?: never;
      inradius?: never;
      sideLength: Exclude<Length, 'auto'>;
    };

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

/** Describes a regular-polygon primitive for JSX or createElement authoring. */
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
