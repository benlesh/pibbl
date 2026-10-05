import type { HorizontalLineStyle } from './horizontal-line.js';
import type { VerticalLineStyle } from './vertical-line.js';
import { definePrimitive } from '../define-primitive.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
  CRCEventParticipationOptions,
} from '../events/types.js';
import {
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import type { CRCPhysics2DPropExtension } from '../types.js';
import { stripLayoutParticipation } from '../style/resolve-built-in.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type {
  BoxStyle,
  CursorStyle,
  LayoutItemStyle,
  PaintStyle,
  ResolvedDrawingStyle,
} from '../style/types.js';
import { layoutDiagnostic } from '../style/diagnostics.js';
import { createLinePath } from '../geometry/line.js';
import { validateCoordinates } from '../geometry/validation.js';
import type { StyleResolutionContext } from '../types.js';
import { renderPath } from './path.js';

/**
 * Authored inputs for Line, including the declared data and presentation options.
 *
 * @see {@link CRCEventHandlers}
 * @see {@link CRCEventParticipationOptions}
 * @see {@link CRCPhysics2DPropExtension}
 * @see {@link Line}
 */
export interface LineProps extends CRCEventHandlers, CRCEventFocusOptions, CRCEventParticipationOptions, CRCPhysics2DPropExtension {}

/**
 * Supported geometry and presentation properties for Line.
 *
 * @see {@link SystemStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link Line}
 * @see {@link HorizontalLineStyle}
 * @see {@link VerticalLineStyle}
 */
export interface LineStyle
  extends SystemStyle, BoxStyle, LayoutItemStyle, Omit<PaintStyle, 'fill'>, CursorStyle {
  /** Ordered coordinate pairs describing the path vertices. See {@link LineStyle}. */
  coords: [number, number][];
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link LineStyle}.
   */
  lineInteractionWidth?: number;
}

type ResolvedLineStyle = ResolvedDrawingStyle<LineStyle>;

export function renderLine(
  props: LineProps,
  style: Readonly<ResolvedLineStyle>,
  ctx: RenderingContext2D,
) {
  const {
    coords,
    stroke,
    strokeWidth,
    opacity,
    cursor,
    lineInteractionWidth,
  } = style;
  const linePath = createLinePath({ coords });
  const interactionWidth = lineInteractionWidth ?? strokeWidth ?? 0;

  return renderPath(
    {
      ...props,
      keyboardNavigationBounds: props.keyboardNavigationBounds ??
        lineBounds(coords, interactionWidth),
    },
    {
      d: linePath,
      stroke,
      strokeWidth,
      opacity,
      cursor,
      lineInteractionWidth: interactionWidth,
    },
    ctx,
  );
}

/**
 * Describes a polyline primitive for JSX or createElement authoring.
 *
 * @param props - Authored component inputs, supplied through JSX or createElement. See the linked
 * props and style types.
 * @throws When called directly; CRC mounts this component through JSX or createElement.
 *
 * @see {@link LineProps}
 * @see {@link LineStyle}
 */
export const Line = definePrimitive<
  LineProps,
  LineStyle,
  LineStyle,
  ResolvedLineStyle
>(renderLine, {
  resolveStyle: (style, context) => ({
    ...stripLayoutParticipation(style),
    coords: validateCoordinates(
      style.coords,
      'coords',
      layoutGeometryErrorFactory(context),
    ),
  }) as ResolvedLineStyle,
});
registerOpaqueStyleProperties(Line, ['stroke', 'cursor']);

function lineBounds(
  coords: readonly [number, number][],
  interactionWidth: number,
) {
  if (coords.length === 0) return undefined;
  const halfWidth = interactionWidth / 2;
  const xs = coords.map(([x]) => x);
  const ys = coords.map(([, y]) => y);
  const left = Math.min(...xs) - halfWidth;
  const right = Math.max(...xs) + halfWidth;
  const top = Math.min(...ys) - halfWidth;
  const bottom = Math.max(...ys) + halfWidth;
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function layoutGeometryErrorFactory(context: Readonly<StyleResolutionContext>) {
  return (property: string, value: unknown, reason: string) => layoutDiagnostic({
    component: context.component,
    property,
    value,
    algorithm: context.algorithm,
    constraints: context.constraints,
    reason,
  });
}
