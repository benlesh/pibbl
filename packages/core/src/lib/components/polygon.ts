import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
} from '../events/types.js';
import {
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import { stripLayoutParticipation } from '../style/resolve-built-in.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type {
  BoxStyle,
  CursorStyle,
  LayoutItemStyle,
  PaintStyle,
  ResolvedDrawingStyle,
} from '../style/types.js';
import { createLinePath } from '../util/create-line-path.js';
import type { StyleResolutionContext } from '../types.js';
import { renderPath } from './path.js';

export interface PolygonProps extends CRCEventHandlers, CRCEventFocusOptions {}

export interface PolygonStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  coords: [number, number][];
  lineInteractionWidth?: number;
}

type ResolvedPolygonStyle = ResolvedDrawingStyle<PolygonStyle> & {
  coords: [number, number][];
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
  } = style;
  const path = coords.length < 3 ?
    new Path2D() :
    createLinePath(coords, { closePath: true });

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
