import { defineComp } from '../define-comp';
import {
  IntrinsicProps,
  CRCBasicMouseEvents,
  FillStyleProps,
  StrokeStyleProps,
  AlphaProps,
  CursorStyleProps,
  PixelGridAlignment,
  RenderingContext2D,
} from '../types';
import { adjustRectangleToPixelGrid } from '../util/pixel-grid-adjustments';
import { Path } from './path';

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
      alignToPixelGrid
    ));
  }

  const rectPath = new Path2D();
  rectPath.rect(x, y, width, height);

  Path(
    {
      ...pathProps,
      path: rectPath,
    },
    ctx
  );
}

/**
 * Creates a renderable Rect component element.
 */
export const rect = defineComp(Rect);
