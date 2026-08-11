import { defineComp } from '../define-comp';
import {
  AlphaProps,
  CRCBasicMouseEvents,
  CursorStyleProps,
  FillStyleProps,
  IntrinsicProps,
  RenderingContext2D,
  StrokeStyleProps,
} from '../types';
import { wireCommonEvents } from '../util/wire-common-events';

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

function checkPropsForEvents(props: CRCBasicMouseEvents) {
  return !!(
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

export function Text(props: TextProps, ctx: RenderingContext2D) {
  const {
    font = '13px sans-serif',
    textBaseline = 'top',
    textAlign = 'left',
    overflow = 'visible',
  } = props;

  ctx.font = font;
  ctx.textBaseline = textBaseline;
  ctx.textAlign = textAlign;

  const {
    strokeStyle,
    lineWidth = 0,
    fillStyle,
    x,
    maxWidth = undefined,
  } = props;

  const renderText = (txt: string, y: number) => {
    const squishMaxWidth = overflow === 'squish' ? maxWidth : undefined;

    if (strokeStyle && lineWidth) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.strokeText(txt, x, y, squishMaxWidth);
    }

    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fillText(txt, x, y, squishMaxWidth);
    }
  };

  const {
    y,
    wordWrap,
    text: inputText,
    lineHeight = 13,
    maxHeight = Infinity,
  } = props;

  const hasAnyEvents = checkPropsForEvents(props);

  let textPath: Path2D | undefined;

  if (wordWrap) {
    const words = inputText.split(' ');
    let line = '';
    let lineCount = 0;

    let textWidth = 0;
    let textHeight = 0;

    const updateTextBounds = (line: string) => {
      const bounds = ctx.measureText(line);
      textWidth = Math.max(bounds.width);
      textHeight =
        lineCount * lineHeight +
        bounds.actualBoundingBoxDescent -
        bounds.actualBoundingBoxAscent;
    };

    if (overflow === 'clip' && maxWidth) {
      const clipPath = new Path2D();
      clipPath.rect(x, y, maxWidth, maxHeight);
      ctx.clip(clipPath);
    }

    while (words.length) {
      const currentYOffset = lineCount * lineHeight;
      const nextYOffset = currentYOffset + lineHeight;
      if (maxHeight < nextYOffset + lineHeight) {
        const remaining = words.join(' ');
        const lastLine =
          overflow === 'ellipsis' && maxWidth ?
              getEllipsisText(ctx, remaining, maxWidth) :
            remaining;
        if (hasAnyEvents) {
          updateTextBounds(lastLine);
        }
        renderText(lastLine, y + currentYOffset);
        break;
      } else {
        if ((maxWidth ?? Infinity) < ctx.measureText(line + words[0]).width) {
          if (hasAnyEvents) {
            updateTextBounds(line);
          }
          renderText(line, y + currentYOffset);
          line = '';
          lineCount++;
        }
        line += words.shift() + ' ';
      }
    }

    if (hasAnyEvents) {
      textPath = new Path2D();
      textPath.rect(x, y, textWidth, textHeight);
    }
  } else {
    const text =
      overflow === 'ellipsis' && maxWidth ?
          getEllipsisText(ctx, inputText, maxWidth) :
        inputText;

    if (overflow === 'clip' && maxWidth) {
      const clipPath = new Path2D();
      const xd = textAlign === 'end' || textAlign === 'right' ?
          -1 :
        textAlign === 'center' ?
          0.5 :
          1;
      const yd =
        textBaseline === 'bottom' ? -1 : textBaseline === 'middle' ? 0.5 : 1;
      const pw = maxWidth * xd;
      const ph = maxHeight * yd;
      clipPath.rect(x, y, pw, ph);
      ctx.clip(clipPath);
    }

    renderText(text, y);

    if (hasAnyEvents) {
      const bounds = ctx.measureText(text);
      const textWidth = bounds.width;
      const textHeight =
        bounds.actualBoundingBoxDescent - bounds.actualBoundingBoxAscent;

      textPath = new Path2D();
      textPath.rect(x, y, textWidth, textHeight);
    }
  }

  wireCommonEvents(props, textPath, true, lineWidth);
}

export const text = defineComp(Text);

function getEllipsisText(
  renderContext: { measureText: (text: string) => TextMetrics },
  text: string,
  maxWidth: number,
) {
  const metrics = renderContext.measureText(text);

  if (metrics.width < maxWidth) {
    return text;
  }

  let low = -1;
  let high = text.length;

  while (1 + low < high) {
    const mid = low + ((high - low) >> 1);
    if (
      isTextTooWide(renderContext, text.substring(0, mid) + '...', maxWidth)
    ) {
      high = mid;
    } else {
      low = mid;
    }
  }

  const properLength = high - 1;
  return `${text.substring(0, properLength)}...`;
}

function isTextTooWide(
  renderContext: { measureText: (text: string) => TextMetrics },
  text: string,
  maxWidth: number,
) {
  const metrics = renderContext.measureText(text);
  return maxWidth < metrics.width;
}
