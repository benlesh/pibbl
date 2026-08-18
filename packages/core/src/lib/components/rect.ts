import { defineComp } from '../define-comp.js';
import {
  CRCBasicMouseEvents,
  RenderingContext2D,
} from '../types.js';
import { RectStyle } from '../style/types.js';
import { adjustRectangleToPixelGrid } from '../util/pixel-grid-adjustments.js';
import { Path } from './path.js';

export interface RectProps extends CRCBasicMouseEvents {}

function Rect(
  props: RectProps,
  style: Readonly<RectStyle>,
  ctx: RenderingContext2D,
) {
  let {
    x = 0,
    y = 0,
    width,
    height,
    alignToPixelGrid,
    ...pathStyle
  } = style;

  if (alignToPixelGrid) {
    ({ x, y, width, height } = adjustRectangleToPixelGrid(
      style.strokeWidth ?? 0,
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
    props,
    {
      ...pathStyle,
      d: rectPath,
    },
    ctx,
  );
}

/**
 * Creates a renderable Rect component element.
 */
export const rect = defineComp(Rect);
