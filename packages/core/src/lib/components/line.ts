import { defineComp } from '../define-comp.js';
import {
  CRCBasicMouseEvents,
  CursorStyleProps,
  IntrinsicProps,
  RenderingContext2D,
  StrokeStyleProps,
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

export function Line(props: LineProps, ctx: RenderingContext2D) {
  const { coords, ...pathProps } = props;
  const linePath = createLinePath(coords);

  return Path(
    {
      ...pathProps,
      path: linePath,
    },
    ctx,
  );
}

/**
 * Creates a renderable Line component element.
 */
export const line = defineComp(Line);
