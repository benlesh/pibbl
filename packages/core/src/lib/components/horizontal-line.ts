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

export interface HorizontalLineProps
  extends IntrinsicProps,
  CRCBasicMouseEvents {}

export interface HorizontalLineStyle
  extends SystemStyle,
  Omit<LineStyle, 'coords'> {
  y: number;
  left?: number;
  right?: number;
  alignToPixelGrid?: PixelGridAlignment;
  lineInteractionWidth?: number;
}

export function HorizontalLine(
  props: HorizontalLineProps,
  style: Readonly<HorizontalLineStyle>,
  ctx: RenderingContext2D,
) {
  const {
    y: initialY,
    left = 0,
    right = ctx.canvas.width,
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
    [left, y],
    [right, y],
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
export const horizontalLine = defineComp(HorizontalLine);
