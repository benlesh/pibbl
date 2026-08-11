import { defineComp } from '../define-comp';
import {
  CRCBasicMouseEvents,
  CursorStyleProps,
  IntrinsicProps,
  PixelGridAlignment,
  RenderingContext2D,
  StrokeStyleProps,
} from '../types';
import { adjustForPixelGrid } from '../util/pixel-grid-adjustments';
import { Line } from './line';

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
  ctx: RenderingContext2D,
) {
  const {
    y: initialY,
    left = 0,
    right = ctx.canvas.width,
    alignToPixelGrid,
    ...lineProps
  } = props;
  const y = alignToPixelGrid ?
      adjustForPixelGrid(initialY, props.lineWidth, alignToPixelGrid) :
    initialY;
  const coords: [number, number][] = [
    [left, y],
    [right, y],
  ];
  return Line(
    {
      coords,
      ...lineProps,
    },
    ctx,
  );
}

/**
 * Creates a renderable HorizontalLine component element
 */
export const horizontalLine = defineComp(HorizontalLine);
