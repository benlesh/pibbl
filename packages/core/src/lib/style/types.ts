import type {
  FillStyle,
  PixelGridAlignment,
  StrokeStyle,
  SystemStyle,
} from '../types.js';
import type { LayoutBox } from '../layout/types.js';

export type Percentage = `${number}%`;
export type Length = number | Percentage | 'auto';

export type EdgeValues =
  | number
  | Readonly<{
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    }>;

export interface BoxStyle extends SystemStyle {
  width?: Length;
  height?: Length;
  minWidth?: Exclude<Length, 'auto'>;
  maxWidth?: Exclude<Length, 'auto'>;
  minHeight?: Exclude<Length, 'auto'>;
  maxHeight?: Exclude<Length, 'auto'>;
  padding?: EdgeValues;
  overflow?: 'visible' | 'clip';
}

export interface ResolvedBoxStyle {
  borderBox: LayoutBox;
  contentBox: LayoutBox;
}

export interface LayoutItemStyle {
  left?: Exclude<Length, 'auto'>;
  top?: Exclude<Length, 'auto'>;
  alignSelf?:
    'auto' | 'start' | 'end' | 'center' | 'stretch' | 'flex-start' | 'flex-end';
  justifySelf?: 'auto' | 'start' | 'end' | 'center' | 'stretch';
  flexBasis?: Length;
  flexGrow?: number;
  flexShrink?: number;
  gridColumnStart?: number;
  gridColumnSpan?: number;
  gridRowStart?: number;
  gridRowSpan?: number;
}

export type FlexItemStyle = Pick<
  LayoutItemStyle,
  'flexBasis' | 'flexGrow' | 'flexShrink'
> & {
  alignSelf?: 'auto' | 'stretch' | 'flex-start' | 'flex-end' | 'center';
};

type LayoutParticipationKey = Exclude<
  keyof BoxStyle | keyof LayoutItemStyle,
  'custom'
>;

export type ResolvedDrawingStyle<S> = Omit<S, LayoutParticipationKey>;

export interface PaintStyle extends SystemStyle {
  fill?: FillStyle;
  stroke?: StrokeStyle;
  strokeWidth?: number;
  opacity?: number;
}

export interface CursorStyle extends SystemStyle {
  cursor?: string;
}

export interface PathStyle
  extends SystemStyle,
    PaintStyle,
    CursorStyle,
    BoxStyle,
    LayoutItemStyle {
  d: Path2D;
  lineInteractionWidth?: number;
}

export interface RectStyle
  extends SystemStyle,
    PaintStyle,
    CursorStyle,
    BoxStyle,
    LayoutItemStyle {
  x?: Exclude<Length, 'auto'>;
  y?: Exclude<Length, 'auto'>;
  width: Length;
  height: Length;
  alignToPixelGrid?: PixelGridAlignment;
  lineInteractionWidth?: number;
}

export interface SvgPathStyle
  extends SystemStyle,
    PaintStyle,
    CursorStyle,
    BoxStyle,
    LayoutItemStyle {
  d: string;
  lineInteractionWidth?: number;
}

export type TextFit = 'visible' | 'squish' | 'ellipsis' | 'clip';

export interface TextStyle
  extends SystemStyle,
    PaintStyle,
    CursorStyle,
    BoxStyle,
    LayoutItemStyle {
  text: string;
  x?: Exclude<Length, 'auto'>;
  y?: Exclude<Length, 'auto'>;
  lineHeight?: number;
  wrap?: boolean;
  fit?: TextFit;
  font?: string;
  textBaseline?: CanvasTextBaseline;
  textAlign?: CanvasTextAlign;
}

export interface ImgStyle
  extends SystemStyle,
    CursorStyle,
    BoxStyle,
    LayoutItemStyle {
  src: string;
  x?: Exclude<Length, 'auto'>;
  y?: Exclude<Length, 'auto'>;
  stroke?: StrokeStyle;
  strokeWidth?: number;
  opacity?: number;
  alignToPixelGrid?: PixelGridAlignment;
}

export type ResolvedPathStyle = ResolvedDrawingStyle<PathStyle>;
export type ResolvedRectStyle = ResolvedDrawingStyle<RectStyle> & {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type ResolvedSvgPathStyle = ResolvedDrawingStyle<SvgPathStyle>;
export type ResolvedTextStyle = ResolvedDrawingStyle<TextStyle> & {
  x: number;
  y: number;
  width?: number;
  height?: number;
};
export type ResolvedImgStyle = ResolvedDrawingStyle<ImgStyle> & {
  x: number;
  y: number;
  width?: number;
  height?: number;
};
