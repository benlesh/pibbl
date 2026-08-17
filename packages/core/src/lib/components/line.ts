import { defineComp } from '../define-comp.js';
import {
  CRCBasicMouseEvents,
  CursorStyleProps,
  IntrinsicProps,
  RenderingContext2D,
  StrokeStyleProps,
  SystemStyle,
} from '../types.js';
import { createLinePath } from '../util/create-line-path.js';
import { Path } from './path.js';

export interface LineProps
  extends IntrinsicProps,
  CRCBasicMouseEvents,
  CursorStyleProps,
  StrokeStyleProps {
  coords: [number, number][];
  lineInteractionWidth?: number;
}

export function Line(props: LineProps, _style: SystemStyle, ctx: RenderingContext2D) {
  const {
    coords,
    cursor,
    lineInteractionWidth,
    lineWidth,
    strokeStyle,
    ...pathProps
  } = props;
  const linePath = createLinePath(coords);

  return Path(
    pathProps,
    {
      d: linePath,
      cursor,
      lineInteractionWidth,
      stroke: strokeStyle,
      strokeWidth: lineWidth,
    },
    ctx,
  );
}

/**
 * Creates a renderable Line component element.
 */
export const line = defineComp(Line);
