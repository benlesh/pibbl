import { defineComp } from '../define-comp.js';
import {
  CRCBasicMouseEvents,
  CursorStyleProps,
  IntrinsicProps,
  PixelGridAlignment,
  RenderingContext2D,
  StrokeStyleProps,
  SystemStyle,
} from '../types.js';
import { adjustForPixelGrid } from '../util/pixel-grid-adjustments.js';
import { Line } from './line.js';

export interface HorizontalLineProps
  extends IntrinsicProps,
  CRCBasicMouseEvents,
  CursorStyleProps,
  StrokeStyleProps {
  y: number;
  left?: number;
  right?: number;
  alignToPixelGrid?: PixelGridAlignment;
  lineInteractionWidth?: number;
}

export function HorizontalLine(
  props: HorizontalLineProps,
  _style: SystemStyle,
  ctx: RenderingContext2D,
) {
  const {
    y: initialY,
    left = 0,
    right = ctx.canvas.width,
    alignToPixelGrid = 'none',
    ...lineProps
  } = props;
  const y = adjustForPixelGrid(initialY, props.lineWidth, alignToPixelGrid);
  const coords: [number, number][] = [
    [left, y],
    [right, y],
  ];
  return Line(
    {
      coords,
      ...lineProps,
    },
    {},
    ctx,
  );
}

/**
 * Creates a renderable HorizontalLine component element
 */
export const horizontalLine = defineComp(HorizontalLine);
