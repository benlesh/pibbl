import { definePrimitive } from '../define-primitive.js';
import type {
  PibblEventFocusOptions,
  PibblEventHandlers,
  PibblEventParticipationOptions,
} from '../events/types.js';
import {
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import type { PibblPhysics2DPropExtension } from '../types.js';
import { stripLayoutParticipation } from '../style/resolve-built-in.js';
import { createPolygonPath } from '../geometry/polygon.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type {
  BoxStyle,
  CursorStyle,
  LayoutItemStyle,
  PaintStyle,
  RoundedCornerStyle,
  ResolvedDrawingStyle,
} from '../style/types.js';
import type { StyleResolutionContext } from '../types.js';
import { renderPath } from './path.js';
import { resolveRoundedCornerStyle } from './rounded-corner-style.js';

/**
 * Authored inputs for Polygon, including the declared data and presentation options.
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblEventParticipationOptions}
 * @see {@link PibblPhysics2DPropExtension}
 * @see {@link Polygon}
 */
export interface PolygonProps extends PibblEventHandlers, PibblEventFocusOptions, PibblEventParticipationOptions, PibblPhysics2DPropExtension {}

/**
 * Supported geometry and presentation properties for Polygon.
 *
 * @see {@link RoundedCornerStyle}
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link Polygon}
 */
export interface PolygonStyle
  extends
    RoundedCornerStyle,
    SystemStyle,
    PaintStyle,
    CursorStyle,
    BoxStyle,
    LayoutItemStyle {
  /** Ordered coordinate pairs describing the path vertices. See {@link PolygonStyle}. */
  coords: [number, number][];
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link PolygonStyle}.
   */
  lineInteractionWidth?: number;
}

type ResolvedPolygonStyle = Omit<
  ResolvedDrawingStyle<PolygonStyle>,
  keyof RoundedCornerStyle
> & {
  coords: [number, number][];
  cornerRadius?: number;
  cornerRadii?: readonly (number | null | undefined)[];
};

function renderPolygon(
  props: PolygonProps,
  style: Readonly<ResolvedPolygonStyle>,
  ctx: RenderingContext2D,
) {
  const {
    coords,
    fill,
    stroke,
    strokeWidth,
    opacity,
    cursor,
    lineInteractionWidth,
    cornerRadius,
    cornerRadii,
  } = style;
  const path = createPolygonPath({ coords, cornerRadius, cornerRadii });

  return renderPath(
    {
      ...props,
      keyboardNavigationBounds: props.keyboardNavigationBounds ??
        polygonBounds(coords),
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
 * Describes a polygon primitive for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; Pibbl mounts this component through JSX or createElement.
 *
 * @see {@link PolygonProps}
 * @see {@link PolygonStyle}
 */
export const Polygon = definePrimitive<
  PolygonProps,
  PolygonStyle,
  PolygonStyle,
  ResolvedPolygonStyle
>(renderPolygon, {
  resolveStyle: (style, context) => {
    const coords = validatePolygonCoords(style.coords, context);
    return {
      ...stripLayoutParticipation(style),
      coords,
      ...resolveRoundedCornerStyle(coords.length, style, context),
    } as ResolvedPolygonStyle;
  },
});
registerOpaqueStyleProperties(Polygon, ['fill', 'stroke', 'cursor']);

function validatePolygonCoords(
  coords: [number, number][],
  context: Readonly<StyleResolutionContext>,
) {
  for (let index = 0; index < coords.length; index++) {
    const [x, y] = coords[index];
    if (!Number.isFinite(x)) {
      throw layoutDiagnostic({
        component: context.component,
        property: `coords[${index}][0]`,
        value: x,
        algorithm: context.algorithm,
        constraints: context.constraints,
        reason: 'must be a finite number',
      });
    }
    if (!Number.isFinite(y)) {
      throw layoutDiagnostic({
        component: context.component,
        property: `coords[${index}][1]`,
        value: y,
        algorithm: context.algorithm,
        constraints: context.constraints,
        reason: 'must be a finite number',
      });
    }
  }
  return coords;
}

function polygonBounds(coords: readonly [number, number][]) {
  if (coords.length === 0) return undefined;
  const xs = coords.map(([x]) => x);
  const ys = coords.map(([, y]) => y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}
