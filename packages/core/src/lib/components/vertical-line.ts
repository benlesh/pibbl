import { defineComp } from '../define-comp.js';
import {
  CRCBasicMouseEvents,
  IntrinsicProps,
  PixelGridAlignment,
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import { adjustForPixelGrid } from '../util/pixel-grid-adjustments.js';
import { Line, type LineStyle } from './line.js';

export interface VerticalLineProps
  extends IntrinsicProps,
  CRCBasicMouseEvents {}

export interface VerticalLineStyle
  extends SystemStyle,
  Omit<LineStyle, 'coords'> {
  x: number;
  top?: number;
  bottom?: number;
  alignToPixelGrid?: PixelGridAlignment;
  lineInteractionWidth?: number;
}

export function VerticalLine(
  props: VerticalLineProps,
  style: Readonly<VerticalLineStyle>,
  ctx: RenderingContext2D,
) {
  const {
    x: initialX,
    top = 0,
    bottom = ctx.canvas.height,
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
    [x, top],
    [x, bottom],
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
export const verticalLine = defineComp(VerticalLine);
