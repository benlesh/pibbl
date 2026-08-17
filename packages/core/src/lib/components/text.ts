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
import { wireCommonEvents } from '../util/wire-common-events.js';

export interface TextProps
  extends IntrinsicProps,
  CRCBasicMouseEvents,
  FillStyleProps,
  StrokeStyleProps,
  AlphaProps,
  CursorStyleProps {
  text: string;
  x: number;
  y: number;
  maxWidth?: number;
  maxHeight?: number;
  lineHeight?: number;
  overflow?: 'visible' | 'squish' | 'ellipsis' | 'clip';
  wordWrap?: boolean;
  font?: string;
  textBaseline?: CanvasTextBaseline;
  textAlign?: CanvasTextAlign;
}

interface TextLine {
  text: string;
  y: number;
}

function checkPropsForEvents(props: CRCBasicMouseEvents & CursorStyleProps) {
  return !!(
    props.cursor ||
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

export function Text(props: TextProps, _style: SystemStyle, ctx: RenderingContext2D) {
  const {
    alpha,
    font = '13px sans-serif',
    textBaseline = 'top',
    textAlign = 'left',
    overflow = 'visible',
  } = props;

  if (alpha !== undefined) {
    ctx.globalAlpha = ctx.globalAlpha * alpha;
  }

  ctx.font = font;
  ctx.textBaseline = textBaseline;
  ctx.textAlign = textAlign;

  const {
    strokeStyle,
    lineWidth = 0,
    fillStyle,
    x,
    y,
    maxWidth,
    maxHeight,
  } = props;

  if (overflow === 'clip' && maxWidth !== undefined) {
    const clipPath = new Path2D();
    const clipHeight = maxHeight ?? ctx.canvas.height;
    const left = alignedLeft(x, maxWidth, textAlign);
    const top = baselineTop(y, clipHeight, textBaseline);
    clipPath.rect(left, top, maxWidth, clipHeight);
    ctx.clip(clipPath);
  }

  const lines = props.wordWrap ?
      wrapText(ctx, props) :
    [{ text: ellipsize(ctx, props.text, maxWidth, overflow), y }];
  const textBounds = checkPropsForEvents(props) ? new Path2D() : undefined;

  for (const line of lines) {
    const squishMaxWidth = overflow === 'squish' ? maxWidth : undefined;

    if (strokeStyle && lineWidth) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.strokeText(line.text, x, line.y, squishMaxWidth);
    }

    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fillText(line.text, x, line.y, squishMaxWidth);
    }

    if (textBounds) {
      const metrics = ctx.measureText(line.text);
      const horizontalScale = squishMaxWidth !== undefined && metrics.width > squishMaxWidth ?
          Math.max(0, squishMaxWidth) / metrics.width :
        1;
      textBounds.rect(
        x - metrics.actualBoundingBoxLeft * horizontalScale,
        line.y - metrics.actualBoundingBoxAscent,
        (metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) * horizontalScale,
        metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
      );
    }
  }

  wireCommonEvents(props, textBounds, true, lineWidth, props.cursor);
}

export const text = defineComp(Text);

function wrapText(ctx: RenderingContext2D, props: TextProps): TextLine[] {
  const {
    text,
    x: _x,
    y,
    maxWidth = Infinity,
    maxHeight = Infinity,
    lineHeight = 13,
    overflow = 'visible',
  } = props;
  const words = text.split(' ');
  const lines: TextLine[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push({ text: line, y: y + lines.length * lineHeight });
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line || words.length === 1) {
    lines.push({ text: line, y: y + lines.length * lineHeight });
  }

  const maxLines = Number.isFinite(maxHeight) ?
      Math.max(0, Math.floor(maxHeight / lineHeight)) :
    lines.length;
  if (lines.length <= maxLines) return lines;
  if (maxLines === 0) return [];

  const visible = lines.slice(0, maxLines);
  if (overflow === 'ellipsis' && Number.isFinite(maxWidth)) {
    const remaining = lines.slice(maxLines - 1).map(value => value.text).join(' ');
    visible[maxLines - 1] = {
      text: getEllipsisText(ctx, remaining, maxWidth),
      y: visible[maxLines - 1].y,
    };
  }
  return visible;
}

function ellipsize(
  ctx: RenderingContext2D,
  text: string,
  maxWidth: number | undefined,
  overflow: TextProps['overflow'],
): string {
  return overflow === 'ellipsis' && maxWidth !== undefined ?
      getEllipsisText(ctx, text, maxWidth) :
    text;
}

function alignedLeft(
  x: number,
  width: number,
  textAlign: CanvasTextAlign,
): number {
  if (textAlign === 'center') return x - width / 2;
  if (textAlign === 'right' || textAlign === 'end') return x - width;
  return x;
}

function baselineTop(
  y: number,
  height: number,
  textBaseline: CanvasTextBaseline,
): number {
  if (textBaseline === 'middle') return y - height / 2;
  if (textBaseline === 'bottom' || textBaseline === 'ideographic') {
    return y - height;
  }
  return y;
}

function getEllipsisText(
  renderContext: { measureText: (text: string) => TextMetrics },
  text: string,
  maxWidth: number,
) {
  const metrics = renderContext.measureText(text);

  if (metrics.width <= maxWidth) {
    return text;
  }
  if (maxWidth <= 0 || isTextTooWide(renderContext, '...', maxWidth)) {
    return '';
  }

  let low = 0;
  let high = text.length;

  while (1 + low < high) {
    const mid = low + ((high - low) >> 1);
    if (
      isTextTooWide(renderContext, `${text.substring(0, mid)}...`, maxWidth)
    ) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return `${text.substring(0, low)}...`;
}

function isTextTooWide(
  renderContext: { measureText: (text: string) => TextMetrics },
  text: string,
  maxWidth: number,
) {
  const metrics = renderContext.measureText(text);
  return maxWidth < metrics.width;
}
