import { defineComp } from '../define-comp.js';
import {
  AlphaProps,
  CRCBasicMouseEvents,
  CursorStyleProps,
  FillStyleProps,
  IntrinsicProps,
  RenderingContext2D,
  StrokeStyleProps,
  SystemStyle,
} from '../types.js';
import { isTransparent } from '../util/is-transparent.js';
import { wireCommonEvents } from '../util/wire-common-events.js';

export interface PathProps
  extends IntrinsicProps,
  CRCBasicMouseEvents,
  FillStyleProps,
  StrokeStyleProps,
  CursorStyleProps,
  AlphaProps {
  path: Path2D;
  lineInteractionWidth?: number;
}

export function Path(
  props: PathProps,
  _style: SystemStyle,
  ctx: RenderingContext2D,
) {
  const {
    alpha,
    path,
    fillStyle,
    strokeStyle,
    lineWidth,
    lineInteractionWidth = lineWidth ?? 0,
  } = props;

  if (alpha !== undefined) {
    ctx.globalAlpha = ctx.globalAlpha * alpha;
  }

  if (fillStyle && !isTransparent(fillStyle)) {
    ctx.fillStyle = fillStyle;
    ctx.fill(path);
  }

  if (strokeStyle && lineWidth && lineWidth > 0) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke(path);
  }

  const fill = !!fillStyle;

  wireCommonEvents(props, path, fill, lineInteractionWidth);
}

/**
 * Creates a renderable Path component element.
 */
export const path = defineComp(Path);
