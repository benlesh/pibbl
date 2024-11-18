import { defineComp } from '../define-comp';
import {
  CRCBasicMouseEvents,
  CursorStyleProps,
  IntrinsicProps,
  RenderingContext2D,
  StrokeStyleProps,
} from '../types';
import { createLinePath } from '../util/create-line-path';
import { Path } from './path';

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
