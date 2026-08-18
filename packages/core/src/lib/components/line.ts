import { defineComp } from '../define-comp.js';
import {
  CRCBasicMouseEvents,
  RenderingContext2D,
  SystemStyle,
} from '../types.js';
import type { CursorStyle, PaintStyle } from '../style/types.js';
import { createLinePath } from '../util/create-line-path.js';
import { Path } from './path.js';

export interface LineProps extends CRCBasicMouseEvents {}

export interface LineStyle
  extends SystemStyle,
  Omit<PaintStyle, 'fill'>,
  CursorStyle {
  coords: [number, number][];
  lineInteractionWidth?: number;
}

export function Line(
  props: LineProps,
  style: Readonly<LineStyle>,
  ctx: RenderingContext2D,
) {
  const {
    coords,
    stroke,
    strokeWidth,
    opacity,
    cursor,
    lineInteractionWidth,
  } = style;
  const linePath = createLinePath(coords);

  return Path(
    props,
    {
      d: linePath,
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
 * Creates a renderable Line component element.
 */
export const line = defineComp(Line);
