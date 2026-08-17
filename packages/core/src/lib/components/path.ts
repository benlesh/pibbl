import { defineComp } from '../define-comp.js';
import {
  CRCBasicMouseEvents,
  IntrinsicProps,
  RenderingContext2D,
} from '../types.js';
import { PathStyle } from '../style/types.js';
import { isTransparent } from '../util/is-transparent.js';
import { wireCommonEvents } from '../util/wire-common-events.js';

export interface PathProps
  extends IntrinsicProps,
  CRCBasicMouseEvents {}

export function Path(
  props: PathProps,
  style: Readonly<PathStyle>,
  ctx: RenderingContext2D,
) {
  const {
    d,
    fill,
    stroke,
    strokeWidth,
    opacity,
    cursor,
    lineInteractionWidth = strokeWidth ?? 0,
  } = style;

  if (opacity !== undefined) {
    ctx.globalAlpha = ctx.globalAlpha * opacity;
  }

  if (fill && !isTransparent(fill)) {
    ctx.fillStyle = fill;
    ctx.fill(d);
  }

  if (stroke && strokeWidth && strokeWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke(d);
  }

  wireCommonEvents(props, d, !!fill, lineInteractionWidth, cursor);
}

/**
 * Creates a renderable Path component element.
 */
export const path = defineComp(Path);
