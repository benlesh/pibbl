import type { TextStyle } from '../style/types.js';

export interface TextBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextLayoutLine {
  text: string;
  x: number;
  y: number;
  bounds: TextBounds;
  squishWidth?: number;
}

export interface TextLayout {
  lines: readonly TextLayoutLine[];
  bounds: TextBounds | undefined;
  clipBounds: TextBounds | undefined;
}

export type MeasureText = (text: string) => TextMetrics;

/** Resolves text line breaking and geometry without rendering or runtime state. */
export function resolveTextLayout(
  measureText: MeasureText,
  style: Readonly<TextStyle>,
): TextLayout {
  const {
    text,
    x = 0,
    y = 0,
    width,
    height,
    lineHeight = 13,
    wrap = false,
    fit = 'visible',
  } = style;
  const literalLines = wrap
    ? wrapText(measureText, text, y, width, height, lineHeight, fit)
    : [{ text: ellipsize(measureText, text, width, fit), y }];
  const lines = literalLines.map(({ text: lineText, y: lineY }) => {
    const metrics = measureText(lineText);
    const squishWidth = fit === 'squish' ? width : undefined;
    const horizontalScale =
      squishWidth !== undefined && metrics.width > squishWidth
        ? Math.max(0, squishWidth) / metrics.width
        : 1;

    return {
      text: lineText,
      x,
      y: lineY,
      bounds: {
        x: x - metrics.actualBoundingBoxLeft * horizontalScale,
        y: lineY - metrics.actualBoundingBoxAscent,
        width:
          (metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) *
          horizontalScale,
        height:
          metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
      },
      ...(squishWidth === undefined ? {} : { squishWidth }),
    } satisfies TextLayoutLine;
  });

  return {
    lines,
    bounds: unionBounds(lines.map((line) => line.bounds)),
    clipBounds: resolveTextClipBounds(style),
  };
}

/** Resolves finite clip geometry, with an optional pure height fallback. */
export function resolveTextClipBounds(
  style: Readonly<TextStyle>,
  fallbackHeight?: number,
): TextBounds | undefined {
  const {
    width,
    fit = 'visible',
    textAlign = 'left',
    textBaseline = 'top',
  } = style;
  if (fit !== 'clip' || width === undefined) return undefined;

  const x = style.x ?? 0;
  const y = style.y ?? 0;
  const height = style.height ?? fallbackHeight;
  if (height === undefined) return undefined;

  return {
    x: alignedLeft(x, width, textAlign),
    y: baselineTop(y, height, textBaseline),
    width,
    height,
  };
}

interface LiteralTextLine {
  text: string;
  y: number;
}

function wrapText(
  measureText: MeasureText,
  text: string,
  y: number,
  width: number | undefined,
  height: number | undefined,
  lineHeight: number,
  fit: TextStyle['fit'],
): LiteralTextLine[] {
  const maxWidth = width ?? Infinity;
  const maxHeight = height ?? Infinity;
  const words = text.split(' ');
  const lines: LiteralTextLine[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measureText(candidate).width > maxWidth) {
      lines.push({ text: line, y: y + lines.length * lineHeight });
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line || words.length === 1) {
    lines.push({ text: line, y: y + lines.length * lineHeight });
  }

  const maxLines = Number.isFinite(maxHeight)
    ? Math.max(0, Math.floor(maxHeight / lineHeight))
    : lines.length;
  if (lines.length <= maxLines) return lines;
  if (maxLines === 0) return [];

  const visible = lines.slice(0, maxLines);
  if (fit === 'ellipsis' && Number.isFinite(maxWidth)) {
    const remaining = lines
      .slice(maxLines - 1)
      .map((value) => value.text)
      .join(' ');
    visible[maxLines - 1] = {
      text: getEllipsisText(measureText, remaining, maxWidth),
      y: visible[maxLines - 1].y,
    };
  }
  return visible;
}

function ellipsize(
  measureText: MeasureText,
  text: string,
  width: number | undefined,
  fit: TextStyle['fit'],
): string {
  return fit === 'ellipsis' && width !== undefined
    ? getEllipsisText(measureText, text, width)
    : text;
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
  measureText: MeasureText,
  text: string,
  maxWidth: number,
): string {
  if (measureText(text).width <= maxWidth) return text;
  if (maxWidth <= 0 || measureText('...').width > maxWidth) return '';

  let low = 0;
  let high = text.length;

  while (1 + low < high) {
    const mid = low + ((high - low) >> 1);
    if (measureText(`${text.substring(0, mid)}...`).width > maxWidth) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return `${text.substring(0, low)}...`;
}

function unionBounds(bounds: readonly TextBounds[]): TextBounds | undefined {
  if (bounds.length === 0) return undefined;

  let left = bounds[0].x;
  let top = bounds[0].y;
  let right = bounds[0].x + bounds[0].width;
  let bottom = bounds[0].y + bounds[0].height;

  for (const value of bounds.slice(1)) {
    left = Math.min(left, value.x);
    top = Math.min(top, value.y);
    right = Math.max(right, value.x + value.width);
    bottom = Math.max(bottom, value.y + value.height);
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}
