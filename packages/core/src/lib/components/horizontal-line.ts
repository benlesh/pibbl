import { defineComp } from '../define-comp.js';
import type {
  CRCEventFocusOptions,
  CRCEventHandlers,
} from '../events/types.js';
import {
  PixelGridAlignment,
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import { adjustForPixelGrid } from '../util/pixel-grid-adjustments.js';
import {
  resolveLocalOffset,
  resolveRequiredLength,
  stripLayoutParticipation,
} from '../style/resolve-built-in.js';
import { registerOpaqueStyleProperties } from '../style/resolve-dispatch.js';
import type {
  BoxStyle,
  LayoutItemStyle,
  Length,
  ResolvedDrawingStyle,
} from '../style/types.js';
import { Line, type LineStyle } from './line.js';

export interface HorizontalLineProps
  extends CRCEventHandlers, CRCEventFocusOptions {}

export interface HorizontalLineStyle
  extends SystemStyle,
  BoxStyle,
  LayoutItemStyle,
  Omit<LineStyle, 'coords'> {
  y: Exclude<Length, 'auto'>;
  x1?: Exclude<Length, 'auto'>;
  x2?: Exclude<Length, 'auto'>;
  alignToPixelGrid?: PixelGridAlignment;
  lineInteractionWidth?: number;
}

type ResolvedHorizontalLineStyle = ResolvedDrawingStyle<HorizontalLineStyle> & {
  y: number;
  x1: number;
  x2: number;
};

export function HorizontalLine(
  props: HorizontalLineProps,
  style: Readonly<ResolvedHorizontalLineStyle>,
  ctx: RenderingContext2D,
) {
  const {
    y: initialY,
    x1 = 0,
    x2 = ctx.canvas.width,
    alignToPixelGrid = 'none',
    stroke,
    strokeWidth,
    opacity,
    cursor,
    lineInteractionWidth,
  } = style;
  const y = adjustForPixelGrid(
    initialY,
    strokeWidth,
    alignToPixelGrid,
  );
  const coords: [number, number][] = [
    [x1, y],
    [x2, y],
  ];
  return Line(
    props,
    {
      coords,
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
 * Creates a renderable HorizontalLine component element
 */
export const horizontalLine = defineComp<
  HorizontalLineProps,
  HorizontalLineStyle,
  HorizontalLineStyle,
  ResolvedHorizontalLineStyle
>(HorizontalLine, {
  resolveStyle: (style, context) => ({
    ...stripLayoutParticipation(style),
    y: resolveRequiredLength(
      style.y,
      context.percentageBasis.height,
      'y',
      context,
    ),
    x1: resolveLocalOffset(
      style.x1,
      context.percentageBasis.width,
      'x1',
      context,
    ),
    x2: resolveRequiredLength(
      style.x2 ?? context.allocation.width,
      context.percentageBasis.width,
      'x2',
      context,
    ),
  }) as ResolvedHorizontalLineStyle,
});
registerOpaqueStyleProperties(HorizontalLine, ['stroke', 'cursor']);
