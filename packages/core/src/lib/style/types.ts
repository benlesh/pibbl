import type {
  FillStyle,
  PixelGridAlignment,
  StrokeStyle,
  SystemStyle,
} from '../types.js';

export interface PaintStyle extends SystemStyle {
  fill?: FillStyle;
  stroke?: StrokeStyle;
  strokeWidth?: number;
  opacity?: number;
}

export interface CursorStyle extends SystemStyle {
  cursor?: string;
}

export interface PathStyle extends SystemStyle, PaintStyle, CursorStyle {
  d: Path2D;
  lineInteractionWidth?: number;
}

export interface RectStyle extends SystemStyle, PaintStyle, CursorStyle {
  x?: number;
  y?: number;
  width: number;
  height: number;
  alignToPixelGrid?: PixelGridAlignment;
  lineInteractionWidth?: number;
}

export interface SvgPathStyle extends SystemStyle, PaintStyle, CursorStyle {
  d: string;
  lineInteractionWidth?: number;
}

export type TextFit = 'visible' | 'squish' | 'ellipsis' | 'clip';

export interface TextStyle extends SystemStyle, PaintStyle, CursorStyle {
  text: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  lineHeight?: number;
  wrap?: boolean;
  fit?: TextFit;
  font?: string;
  textBaseline?: CanvasTextBaseline;
  textAlign?: CanvasTextAlign;
}
