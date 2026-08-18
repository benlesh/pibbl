import { defineComp } from '../define-comp.js';
import {
  CRCBasicMouseEvents,
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

export interface VerticalLineProps extends CRCBasicMouseEvents {}

export interface VerticalLineStyle
  extends SystemStyle,
  BoxStyle,
  LayoutItemStyle,
  Omit<LineStyle, 'coords'> {
  x: Exclude<Length, 'auto'>;
  y1?: Exclude<Length, 'auto'>;
  y2?: Exclude<Length, 'auto'>;
  alignToPixelGrid?: PixelGridAlignment;
  lineInteractionWidth?: number;
}

type ResolvedVerticalLineStyle = ResolvedDrawingStyle<VerticalLineStyle> & {
  x: number;
  y1: number;
  y2: number;
};

export function VerticalLine(
  props: VerticalLineProps,
  style: Readonly<ResolvedVerticalLineStyle>,
  ctx: RenderingContext2D,
) {
  const {
    x: initialX,
    y1 = 0,
    y2 = ctx.canvas.height,
    alignToPixelGrid = 'none',
    stroke,
    strokeWidth,
    opacity,
    cursor,
    lineInteractionWidth,
  } = style;
  const x = adjustForPixelGrid(
    initialX,
    strokeWidth,
    alignToPixelGrid,
  );
  const coords: [number, number][] = [
    [x, y1],
    [x, y2],
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
 * Creates a renderable VerticalLine component element.
 */
export const verticalLine = defineComp<
  VerticalLineProps,
  VerticalLineStyle,
  VerticalLineStyle,
  ResolvedVerticalLineStyle
>(VerticalLine, {
  resolveStyle: (style, context) => ({
    ...stripLayoutParticipation(style),
    x: resolveRequiredLength(
      style.x,
      context.percentageBasis.width,
      'x',
      context,
    ),
    y1: resolveLocalOffset(
      style.y1,
      context.percentageBasis.height,
      'y1',
      context,
    ),
    y2: resolveRequiredLength(
      style.y2 ?? context.allocation.height,
      context.percentageBasis.height,
      'y2',
      context,
    ),
  }) as ResolvedVerticalLineStyle,
});
registerOpaqueStyleProperties(VerticalLine, ['stroke', 'cursor']);
