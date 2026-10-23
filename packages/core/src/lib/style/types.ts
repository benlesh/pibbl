import type { normalizeEdges } from './normalize.js';
import type { GridStyle } from '../layout/grid.js';
import type { Image } from '../components/img.js';
import type { resolveBox } from '../layout/box.js';
import type { SvgPath } from '../components/svg-path.js';
import type { Text } from '../components/text.js';
import type { PolygonStyle } from '../components/polygon.js';
import type { StarStyle } from '../components/star.js';
import type { PathGeometry } from '../geometry/path-geometry.js';
import type {
  FillStyle,
  PixelGridAlignment,
  StrokeStyle,
  SystemStyle,
} from '../types.js';
import type { LayoutBox } from '../layout/types.js';
import type { PositioningStyle } from './positioning.js';

/**
 * A percentage string resolved against the relevant parent layout dimension.
 *
 * @see {@link Length}
 */
export type Percentage = `${number}%`;
/**
 * A layout length in logical units, a parent-relative percentage, or automatic sizing.
 *
 * @see {@link Percentage}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link RectStyle}
 */
export type Length = number | Percentage | 'auto';

/**
 * Uniform and per-vertex corner radii for supported drawing primitives.
 *
 * @see {@link Length}
 * @see {@link RectStyle}
 * @see {@link PolygonStyle}
 * @see {@link StarStyle}
 */
export interface RoundedCornerStyle {
  /** Uniform corner radius used where no per-corner override is supplied. See {@link Length}. */
  cornerRadius?: Exclude<Length, 'auto'>;
  /** Per-corner radii; nullish entries use the uniform corner radius. See {@link Length}. */
  cornerRadii?: readonly (Exclude<Length, 'auto'> | null | undefined)[];
}

/**
 * One inset for every edge or independently specified top, right, bottom, and left insets.
 *
 * @typeParam T - Permitted edge values; defaults to numeric insets. Padding may opt into {@link Percentage}.
 *
 * @see {@link BoxStyle}
 * @see {@link normalizeEdges}
 */
export type EdgeValues<T extends number | Percentage = number> =
  | T
  | Readonly<{
      /** Top edge value or top envelope guide. See {@link EdgeValues}. */
      top?: T;
      /** Right edge coordinate or inset. See {@link EdgeValues}. */
      right?: T;
      /** Bottom edge value or bottom envelope guide. See {@link EdgeValues}. */
      bottom?: T;
      /** Left edge coordinate or inset. See {@link EdgeValues}. */
      left?: T;
    }>;

/**
 * Declared box dimensions, size limits, padding, and overflow behavior.
 *
 * @see {@link SystemStyle}
 * @see {@link Length}
 * @see {@link EdgeValues}
 * @see {@link ImgStyle}
 * @see {@link PathStyle}
 * @see {@link RectStyle}
 */
export interface BoxStyle extends SystemStyle {
  /** Selects whether dimensions, bounds and Flex basis include padding and layout borders. Defaults to content-box.
   * Border-box content floors at zero and the outer box floors at total axis padding plus layout borders.
   * Painted stroke widths remain independent. See {@link ResolvedBoxStyle}.
   */
  boxSizing?: 'content-box' | 'border-box';
  /** Horizontal extent in the units of the containing geometry or surface. See {@link Length}. */
  width?: Length;
  /** Vertical extent in the units of the containing geometry or surface. See {@link Length}. */
  height?: Length;
  /** Minimum permitted width. See {@link Length}. */
  minWidth?: Exclude<Length, 'auto'>;
  /** Maximum permitted width. See {@link Length}. */
  maxWidth?: Exclude<Length, 'auto'>;
  /** Minimum permitted height. See {@link Length}. */
  minHeight?: Exclude<Length, 'auto'>;
  /** Maximum permitted height. See {@link Length}. */
  maxHeight?: Exclude<Length, 'auto'>;
  /** Padding inside layout borders. Experimental allocated Flex percentages use owner content width for every edge. See {@link EdgeValues}, {@link Percentage}. */
  padding?: EdgeValues<number | Percentage>;
  /** Nonnegative inline-start padding overriding its physical padding edge. Experimental percentages require an allocated Flex owner and use its content width. See {@link BoxStyle}. */
  paddingStart?: number | Percentage;
  /** Nonnegative inline-end padding overriding its physical padding edge. See {@link BoxStyle}. */
  paddingEnd?: number | Percentage;
  /** Layout-only physical border insets, in logical pixels. Defaults to zero; does not paint a stroke. See {@link EdgeValues}. */
  borderWidth?: EdgeValues;
  /** Experimental nonnegative numeric inline-start layout border overriding its physical borderWidth edge. Does not paint a stroke. See {@link BoxStyle}. */
  borderStartWidth?: number;
  /** Experimental nonnegative numeric inline-end layout border overriding its physical borderWidth edge. See {@link BoxStyle}. */
  borderEndWidth?: number;
  /** Selects `"visible"`, `"clip"` for overflow. See {@link BoxStyle}. */
  overflow?: 'visible' | 'clip';
}

/**
 * Resolved border and content boxes after sizing and padding are applied.
 *
 * @see {@link LayoutBox}
 * @see {@link resolveBox}
 */
export interface ResolvedBoxStyle {
  /** The resolved outer rectangle including padding. See {@link LayoutBox}. */
  borderBox: LayoutBox;
  /** The resolved rectangle available to content after padding. See {@link LayoutBox}. */
  contentBox: LayoutBox;
}

/** Flex edge margin value. Auto consumes remaining positive main space in experimental finite nowrap Flex. See {@link FlexItemStyle}. */
export type FlexMargin = number | Percentage | 'auto';

/**
 * Parent-layout participation: positioning, self-alignment, flex sizing, and explicit grid placement.
 *
 * @see {@link Length}
 * @see {@link FlexItemStyle}
 * @see {@link ImgStyle}
 * @see {@link PathStyle}
 */
export interface LayoutItemStyle extends PositioningStyle {
  /** Positive finite outer width/height ratio consumed by finite Flex, including wrapped lines. Final per-line main size derives cross size before cross bounds; intrinsic main sizing is unsupported. See {@link FlexItemStyle}. */
  aspectRatio?: number;
  /** Uniform physical margin in logical Canvas units or a percentage of allocated Flex content width. Finite negatives are allowed; specific edges override this value. Consumed by experimental Flex only. See {@link LayoutItemStyle}. */
  margin?: number | Percentage;
  /** Physical top margin overriding margin. See {@link LayoutItemStyle}. */
  marginTop?: FlexMargin;
  /** Physical right margin overriding margin. See {@link LayoutItemStyle}. */
  marginRight?: FlexMargin;
  /** Physical bottom margin overriding margin. See {@link LayoutItemStyle}. */
  marginBottom?: FlexMargin;
  /** Physical left margin overriding margin. See {@link LayoutItemStyle}. */
  marginLeft?: FlexMargin;
  /** Inline-start margin overriding the corresponding physical edge and margin shorthand in experimental Flex. Signed percentages use allocated content width. See {@link LayoutItemStyle}. */
  marginStart?: FlexMargin;
  /** Inline-end margin overriding the corresponding physical edge and margin shorthand in experimental Flex. See {@link LayoutItemStyle}. */
  marginEnd?: FlexMargin;
  /** This child's cross-axis or block-axis alignment override. See {@link LayoutItemStyle}. */
  alignSelf?: 'auto' | 'start' | 'end' | 'center' | 'stretch' | 'flex-start' | 'flex-end';
  /** This child's inline-axis alignment override. See {@link LayoutItemStyle}. */
  justifySelf?: 'auto' | 'start' | 'end' | 'center' | 'stretch';
  /** Initial main-axis size before flex growth or shrinkage. See {@link Length}. */
  flexBasis?: Length;
  /** Relative share of positive free space assigned to this child. See {@link LayoutItemStyle}. */
  flexGrow?: number;
  /** Relative factor used when reducing main-axis size. See {@link LayoutItemStyle}. */
  flexShrink?: number;
  /** Explicit starting grid column. See {@link LayoutItemStyle}. */
  gridColumnStart?: number;
  /** Number of columns occupied by this child. See {@link LayoutItemStyle}. */
  gridColumnSpan?: number;
  /** Explicit starting grid row. See {@link LayoutItemStyle}. */
  gridRowStart?: number;
  /** Number of rows occupied by this child. See {@link LayoutItemStyle}. */
  gridRowSpan?: number;
}

/**
 * The supported flex sizing and cross-axis alignment properties of a child.
 *
 * @see {@link LayoutItemStyle}
 */
export type FlexItemStyle = Pick<
  LayoutItemStyle,
  'aspectRatio' | 'flexBasis' | 'flexGrow' | 'flexShrink' | 'margin' | 'marginTop' | 'marginRight' | 'marginBottom' | 'marginLeft' | 'marginStart' | 'marginEnd'
> & {
  /** This child's cross-axis or block-axis alignment override. See {@link FlexItemStyle}. */
  alignSelf?: 'auto' | 'stretch' | 'flex-start' | 'flex-end' | 'center' | 'start' | 'end';
};

/**
 * Explicit grid cell placement, spans, and alignment of a child.
 *
 * @see {@link SystemStyle}
 * @see {@link GridStyle}
 */
export interface GridItemStyle extends SystemStyle {
  /** Explicit starting grid column. See {@link GridItemStyle}. */
  gridColumnStart?: number;
  /** Number of columns occupied by this child. See {@link GridItemStyle}. */
  gridColumnSpan?: number;
  /** Explicit starting grid row. See {@link GridItemStyle}. */
  gridRowStart?: number;
  /** Number of rows occupied by this child. See {@link GridItemStyle}. */
  gridRowSpan?: number;
  /** This child's cross-axis or block-axis alignment override. See {@link GridItemStyle}. */
  alignSelf?: 'auto' | 'stretch' | 'start' | 'center' | 'end';
  /** This child's inline-axis alignment override. See {@link GridItemStyle}. */
  justifySelf?: 'auto' | 'stretch' | 'start' | 'center' | 'end';
}

type LayoutParticipationKey = Exclude<
  keyof BoxStyle | keyof LayoutItemStyle,
  'custom' | 'filter'
>;

export type ResolvedDrawingStyle<S> = Omit<S, LayoutParticipationKey>;

/**
 * Fill, stroke, stroke width, and opacity shared by drawing primitives.
 *
 * @see {@link SystemStyle}
 * @see {@link FillStyle}
 * @see {@link StrokeStyle}
 * @see {@link PathStyle}
 * @see {@link RectStyle}
 * @see {@link SvgPathStyle}
 */
export interface PaintStyle extends SystemStyle {
  /** Paint used for the interior. See {@link FillStyle}. */
  fill?: FillStyle;
  /** Paint used for the outline. See {@link StrokeStyle}. */
  stroke?: StrokeStyle;
  /** Width of the painted outline. See {@link PaintStyle}. */
  strokeWidth?: number;
  /** Opacity of the painted result. See {@link PaintStyle}. */
  opacity?: number;
}

/**
 * Cursor presentation for an interactive primitive.
 *
 * @see {@link SystemStyle}
 * @see {@link ImgStyle}
 * @see {@link PathStyle}
 * @see {@link RectStyle}
 */
export interface CursorStyle extends SystemStyle {
  /** Cursor shown while this target owns pointer presentation. See {@link CursorStyle}. */
  cursor?: string;
}

/**
 * Geometry, paint, layout, and interaction width for drawing a path.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link PathGeometry}
 */
export interface PathStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  /**
   * Geometry to draw or clip, supplied in the declared path representation. See
   * {@link PathGeometry}.
   */
  d: Path2D | PathGeometry;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link PathStyle}.
   */
  lineInteractionWidth?: number;
}

/**
 * Rectangle dimensions, paint, corner rounding, and pixel-grid alignment.
 *
 * @see {@link RoundedCornerStyle}
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link Length}
 * @see {@link PixelGridAlignment}
 */
export interface RectStyle
  extends
    RoundedCornerStyle,
    SystemStyle,
    PaintStyle,
    CursorStyle,
    BoxStyle,
    LayoutItemStyle {
  /** Horizontal extent in the units of the containing geometry or surface. See {@link Length}. */
  width: Length;
  /** Vertical extent in the units of the containing geometry or surface. See {@link Length}. */
  height: Length;
  /**
   * Pixel-grid alignment policy applied to the resolved geometry. See {@link PixelGridAlignment}.
   */
  alignToPixelGrid?: PixelGridAlignment;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link RectStyle}.
   */
  lineInteractionWidth?: number;
}

/**
 * SVG path data together with paint, layout, and interaction styling.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link SvgPath}
 */
export interface SvgPathStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  /**
   * Geometry to draw or clip, supplied in the declared path representation. See
   * {@link SvgPathStyle}.
   */
  d: string;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link SvgPathStyle}.
   */
  lineInteractionWidth?: number;
}

/**
 * How text that exceeds its box remains visible, compresses, truncates, or clips.
 *
 * @see {@link TextStyle}
 */
export type TextFit = 'visible' | 'squish' | 'ellipsis' | 'clip';

/**
 * Font, alignment, wrapping, overflow fitting, paint, and layout of Canvas text.
 *
 * @see {@link SystemStyle}
 * @see {@link PaintStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link TextFit}
 * @see {@link Text}
 */
export interface TextStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  /** Spacing between successive text lines. See {@link TextStyle}. */
  lineHeight?: number;
  /** Whether content may wrap into additional lines. See {@link TextStyle}. */
  wrap?: boolean;
  /** Policy for fitting content within its available box. See {@link TextFit}. */
  fit?: TextFit;
  /** Canvas font string used to draw or measure text. See {@link TextStyle}. */
  font?: string;
  /** Canvas baseline used when placing text. See {@link TextStyle}. */
  textBaseline?: CanvasTextBaseline;
  /** Canvas horizontal alignment used when placing text. See {@link TextStyle}. */
  textAlign?: CanvasTextAlign;
}

/**
 * Image source, sizing, opacity, outline, and pixel-grid alignment.
 *
 * @see {@link SystemStyle}
 * @see {@link CursorStyle}
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link StrokeStyle}
 * @see {@link PixelGridAlignment}
 * @see {@link Image}
 */
export interface ImgStyle extends SystemStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  /** Image URL loaded by the drawing primitive. See {@link ImgStyle}. */
  src: string;
  /** Paint used for the outline. See {@link StrokeStyle}. */
  stroke?: StrokeStyle;
  /** Width of the painted outline. See {@link ImgStyle}. */
  strokeWidth?: number;
  /** Opacity of the painted result. See {@link ImgStyle}. */
  opacity?: number;
  /**
   * Pixel-grid alignment policy applied to the resolved geometry. See {@link PixelGridAlignment}.
   */
  alignToPixelGrid?: PixelGridAlignment;
}

export type ResolvedPathStyle = ResolvedDrawingStyle<PathStyle>;
export type ResolvedRectStyle = Omit<
  ResolvedDrawingStyle<RectStyle>,
  keyof RoundedCornerStyle
> & {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius?: number;
  cornerRadii?: readonly (number | null | undefined)[];
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
