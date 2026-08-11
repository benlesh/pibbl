import { defineComp } from '../define-comp.js';
import {
  AlphaProps,
  CRCBasicMouseEvents,
  CursorStyleProps,
  FillStyleProps,
  IntrinsicProps,
  PixelGridAlignment,
  RenderingContext2D,
  StrokeStyleProps,
} from '../types.js';
import { adjustRectangleToPixelGrid } from '../util/pixel-grid-adjustments.js';
import { Path } from './path.js';

export interface RectProps
  extends IntrinsicProps,
  CRCBasicMouseEvents,
  FillStyleProps,
  StrokeStyleProps,
  AlphaProps,
  CursorStyleProps {
  x: number;
  y: number;
  width: number;
  height: number;
  alignToPixelGrid?: PixelGridAlignment;
}

function Rect(props: RectProps, ctx: RenderingContext2D) {
  let { x, y, width, height, alignToPixelGrid, ...pathProps } = props;

  if (alignToPixelGrid) {
    ({ x, y, width, height } = adjustRectangleToPixelGrid(
      props.lineWidth ?? 0,
      x,
      y,
      width,
      height,
      alignToPixelGrid,
    ));
  }

  const rectPath = new Path2D();
  rectPath.rect(x, y, width, height);

  Path(
    {
      ...pathProps,
      path: rectPath,
    },
    ctx,
  );
}

/**
 * Creates a renderable Rect component element.
 */
export const rect = defineComp(Rect);
