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

export interface VerticalLineProps
  extends IntrinsicProps,
  CRCBasicMouseEvents,
  CursorStyleProps,
  StrokeStyleProps {
  x: number;
  top?: number;
  bottom?: number;
  alignToPixelGrid?: PixelGridAlignment;
  lineInteractionWidth?: number;
}

export function VerticalLine(
  props: VerticalLineProps,
  ctx: RenderingContext2D,
) {
  const {
    x: initialX,
    top = 0,
    bottom = ctx.canvas.height,
    alignToPixelGrid = 'none',
    ...lineProps
  } = props;
  const x = adjustForPixelGrid(initialX, props.lineWidth, alignToPixelGrid);
  const coords: [number, number][] = [
    [x, top],
    [x, bottom],
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
 * Creates a renderable VerticalLine component element.
 */
export const verticalLine = defineComp(VerticalLine);
