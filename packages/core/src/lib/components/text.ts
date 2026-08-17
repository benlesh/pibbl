import { defineComp } from '../define-comp.js';
import type { TextStyle } from '../style/types.js';
import {
  CRCBasicMouseEvents,
  IntrinsicProps,
  RenderingContext2D,
} from '../types.js';
import { wireCommonEvents } from '../util/wire-common-events.js';
import { pushClippingPath } from '../util/push-clipping-path.js';
import { resolveTextClipBounds, resolveTextLayout } from './text-layout.js';

export interface TextProps extends IntrinsicProps, CRCBasicMouseEvents {}

function checkPropsForEvents(
  props: CRCBasicMouseEvents,
  cursor: string | undefined,
) {
  return !!(
    cursor ||
    props.onClick ||
    props.onContextMenu ||
    props.onDblClick ||
    props.onMouseDown ||
    props.onMouseMove ||
    props.onMouseOut ||
    props.onMouseOver ||
    props.onMouseUp
  );
}

export function Text(
  props: TextProps,
  style: Readonly<TextStyle>,
  ctx: RenderingContext2D,
) {
  const {
    font = '13px sans-serif',
    textBaseline = 'top',
    textAlign = 'left',
    fill,
    stroke,
    strokeWidth = 0,
    opacity,
    cursor,
  } = style;

  if (opacity !== undefined) {
    ctx.globalAlpha = ctx.globalAlpha * opacity;
  }

  ctx.font = font;
  ctx.textBaseline = textBaseline;
  ctx.textAlign = textAlign;

  const layout = resolveTextLayout(value => ctx.measureText(value), style);
  const clipBounds =
    layout.clipBounds ?? resolveTextClipBounds(style, ctx.canvas.height);

  let releaseClip: (() => void) | undefined;
  if (clipBounds) {
    const clipPath = new Path2D();
    clipPath.rect(
      clipBounds.x,
      clipBounds.y,
      clipBounds.width,
      clipBounds.height,
    );
    releaseClip = pushClippingPath(ctx, clipPath);
  }

  try {
    const textBounds =
      checkPropsForEvents(props, cursor) ? new Path2D() : undefined;

    for (const line of layout.lines) {
      if (stroke && strokeWidth) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = strokeWidth;
        ctx.strokeText(line.text, line.x, line.y, line.squishWidth);
      }

      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillText(line.text, line.x, line.y, line.squishWidth);
      }

      textBounds?.rect(
        line.bounds.x,
        line.bounds.y,
        line.bounds.width,
        line.bounds.height,
      );
    }

    wireCommonEvents(props, textBounds, true, strokeWidth, cursor);
  } finally {
    releaseClip?.();
  }
}

export const text = defineComp(Text);
