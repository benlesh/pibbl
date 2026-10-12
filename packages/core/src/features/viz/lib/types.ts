import type { BarCategoryAccessor } from "./bar-series.js";
import type { LinearScale } from "./linear-scale-component.js";
import type { nearestDomainValue } from "./nearest.js";
import type { useLinearScale } from "./use-linear-scale.js";
import type { Axis } from "./axis.js";
import type { PointAccessor } from "./point-types.js";
import type { ScaleAdjust } from "./scale-adjust.js";
import type {
  BoxStyle,
  PibblNode,
  LayoutItemStyle,
  LayoutBox,
  SignalValue,
} from "@pibbl/core";
import type { SignalStyle } from "@pibbl/core/internal";
import type { SeriesCurve } from "./curve-definition.js";
/**
 * A string or symbol identifying a scale within visualization context.
 *
 * @see {@link BandScaleRange}
 * @see {@link LinearScaleProps}
 * @see {@link LineSeriesProps}
 */
export type ScaleId = string | symbol;
/**
 * The two numeric endpoints of a continuous scale domain.
 *
 * @see {@link LinearScaleProps}
 * @see {@link ResolvedLinearScale}
 */
export type LinearDomain = readonly [number, number];
/**
 * An explicit numeric range or a range derived from layout width or height.
 *
 * @see {@link BandScaleRange}
 * @see {@link LinearScaleProps}
 */
export type ScaleRange = "width" | "height" | readonly [number, number];
/**
 * A logical range or the bandwidth of another scale for nested band layouts.
 *
 * @see {@link ScaleRange}
 * @see {@link ScaleId}
 * @see {@link BarScaleProps}
 */
export type BandScaleRange =
  | ScaleRange
  | {
      /** Identifier of a parent band scale whose bandwidth supplies this range. See {@link ScaleId}. */
      readonly bandwidthOf: ScaleId;
    };
/**
 * Sizing and parent-layout participation of a scale's coordinate frame.
 *
 * @see {@link BoxStyle}
 * @see {@link LayoutItemStyle}
 * @see {@link LinearScaleProps}
 */
export type ScaleLayoutStyle = Pick<BoxStyle, "width" | "height"> &
  LayoutItemStyle;
/**
 * Authored inputs for LinearScale, including the declared data and presentation options.
 *
 * @see {@link ScaleId}
 * @see {@link SignalValue}
 * @see {@link LinearDomain}
 * @see {@link ScaleRange}
 * @see {@link SignalStyle}
 * @see {@link ScaleLayoutStyle}
 * @see {@link PibblNode}
 * @see {@link BarScaleProps}
 */
export interface LinearScaleProps {
  /** Stable identifier of this resource or connection. See {@link ScaleId}. */
  readonly id: ScaleId;
  /**
   * Data values or endpoints accepted by the scale. See {@link SignalValue}, {@link LinearDomain}
   * .
   */
  readonly domain: SignalValue<LinearDomain>;
  /**
   * Logical output coordinates produced by the scale. See {@link SignalValue}, {@link ScaleRange}
   * .
   */
  readonly range: SignalValue<ScaleRange>;
  /** Whether to reverse the direction of the mapping or guide. See {@link SignalValue}. */
  readonly reverse?: SignalValue<boolean>;
  /**
   * Declared presentation and layout properties. See {@link SignalValue}, {@link SignalStyle},
   * {@link ScaleLayoutStyle}.
   */
  readonly style?: SignalValue<SignalStyle<ScaleLayoutStyle>>;
  /** Descendant content or the callback that supplies it. See {@link PibblNode}. */
  readonly children?: PibblNode;
}
/**
 * A string or number used as a discrete band-scale category.
 *
 * @see {@link BandDomain}
 * @see {@link ResolvedBandScale}
 * @see {@link BarCategoryAccessor}
 */
export type BandCategory = string | number;
/**
 * The ordered categories allocated by a band scale.
 *
 * @see {@link BandCategory}
 * @see {@link BarScaleProps}
 * @see {@link ResolvedBandScale}
 */
export type BandDomain = readonly BandCategory[];
/**
 * Authored inputs for BandScale, including the declared data and presentation options.
 *
 * @see {@link LinearScaleProps}
 * @see {@link SignalValue}
 * @see {@link BandDomain}
 * @see {@link BandScaleRange}
 * @see {@link LinearScaleProps}
 */
export interface BarScaleProps extends Omit<
  LinearScaleProps,
  "domain" | "range"
> {
  /**
   * Data values or endpoints accepted by the scale. See {@link SignalValue}, {@link BandDomain}.
   */
  readonly domain: SignalValue<BandDomain>;
  /**
   * Logical output coordinates produced by the scale. See {@link SignalValue},
   * {@link BandScaleRange}.
   */
  readonly range: SignalValue<BandScaleRange>;
  /** Relative spacing between adjacent categorical bands. See {@link SignalValue}. */
  readonly paddingInner?: SignalValue<number>;
  /** Relative spacing outside the first and last categorical bands. See {@link SignalValue}. */
  readonly paddingOuter?: SignalValue<number>;
}
/**
 * Authored inputs for Scale, including the declared data and presentation options.
 *
 * @see {@link LinearScaleProps}
 * @see {@link BarScaleProps}
 * @see {@link LinearScale}
 */
/** UTC timestamps use numeric epoch milliseconds. See {@link LinearDomain}. */
export type UtcDomain = LinearDomain;
/** Numeric endpoints shared by continuous scales. See {@link LinearDomain}. */
export type NumericDomain = LinearDomain;
/** Calendar-aware UTC scale inputs. See {@link LinearScaleProps}. */
export type UTCScaleProps = LinearScaleProps;
/**
 * A resolved categorical mapping with its frame, bandwidth, and step.
 *
 * @see {@link BandDomain}
 * @see {@link LayoutBox}
 * @see {@link BandCategory}
 * @see {@link ResolvedScale}
 */
export interface ResolvedBandScale {
  /** The literal "band" identifying this variant. See {@link ResolvedBandScale}. */
  readonly type: "band";
  /** Data values or endpoints accepted by the scale. See {@link BandDomain}. */
  readonly domain: BandDomain;
  /** Logical output coordinates produced by the scale. See {@link ResolvedBandScale}. */
  readonly range: readonly [number, number];
  /** Resolved layout frame containing the scale. See {@link LayoutBox}. */
  readonly frame: Readonly<LayoutBox>;
  /** Width allocated to one categorical band. See {@link ResolvedBandScale}. */
  readonly bandwidth: number;
  /** Distance between successive band starts. See {@link ResolvedBandScale}. */
  readonly step: number;
  /**
   * Maps a category to its band coordinate, or returns undefined for an unknown category. See
   * {@link ResolvedBandScale} .
   * @param value - Category to locate in the domain. See {@link BandCategory}.
   * @returns The category's range position, or undefined if it is absent from the domain.
   */
  map(value: BandCategory): number | undefined;
}
/**
 * A resolved continuous scale with forward mapping, inversion, and tick generation.
 *
 * @see {@link LinearDomain}
 * @see {@link LayoutBox}
 * @see {@link ResolvedScale}
 * @see {@link nearestDomainValue}
 */
export interface ResolvedLinearScale {
  /** The literal "linear" identifying this variant. See {@link ResolvedLinearScale}. */
  readonly type: "linear";
  /** Data values or endpoints accepted by the scale. See {@link LinearDomain}. */
  readonly domain: LinearDomain;
  /** Logical output coordinates produced by the scale. See {@link ResolvedLinearScale}. */
  readonly range: readonly [number, number];
  /** Resolved layout frame containing the scale. See {@link LayoutBox}. */
  readonly frame: Readonly<LayoutBox>;
  /**
   * Maps a numeric domain value to a logical range coordinate. See {@link ResolvedLinearScale}.
   * @param value - Numeric domain coordinate.
   * @returns The corresponding range coordinate.
   */
  map(value: number): number;
  /**
   * Maps a logical range coordinate back into the numeric domain. See {@link ResolvedLinearScale}
   * .
   * @param pixel - Coordinate in the scale's pixel range.
   * @returns The corresponding numeric domain value.
   */
  invert(pixel: number): number;
  /**
   * Returns representative numeric tick values for the requested count. See
   * {@link ResolvedLinearScale}.
   * @param count - Suggested number of ticks.
   * @returns Tick values in domain coordinates.
   */
  ticks(count?: number): readonly number[];
}
/**
 * A resolved linear or categorical band scale.
 *
 * @see {@link ResolvedLinearScale}
 * @see {@link ResolvedBandScale}
 * @see {@link useLinearScale}
 */
/** UTC continuous mapping with stateless ISO formatting. See {@link ResolvedLinearScale}. */
export interface ResolvedUtcScale extends Omit<ResolvedLinearScale, "type"> {
  /** UTC calendar scale discriminant. See {@link UTCScaleProps}. */
  readonly type: "utc";
  /**
   * Formats a timestamp as full UTC ISO text without changing tick geometry.
   * @param value - Finite epoch milliseconds inside the Date range.
   * @returns ISO text with millisecond precision. See {@link ResolvedUtcScale}.
   */
  formatTick(value: number): string;
}
/** Any supported numeric mapping. See {@link ResolvedUtcScale}. */
export type ResolvedContinuousScale =
  | ResolvedLinearScale
  | ResolvedUtcScale
  | ResolvedLogScale
  | ResolvedSymlogScale;
/** Positive logarithmic provider inputs. See {@link LinearScaleProps}. */
export interface LogScaleProps extends LinearScaleProps {
  /** Base for power ticks; finite and greater than one, default 10. Mapping is base-independent. */
  readonly base?: SignalValue<number>;
}
/** Positive logarithmic mapping with numeric inverse. See {@link ResolvedLinearScale}. */
export interface ResolvedLogScale extends Omit<ResolvedLinearScale, "type"> {
  /** Logarithmic mapping discriminant. See {@link LogScaleProps}. */
  readonly type: "log";
  /** Resolved base used for power ticks. See {@link LogScaleProps}. */
  readonly base: number;
}
/** A numeric or categorical mapping snapshot. See {@link ResolvedContinuousScale}. */
export type ResolvedScale =
  | ResolvedContinuousScale
  | ResolvedBandScale
  | ResolvedPointScale
  | import("./trading-time-scale.js").ResolvedTradingTimeScale;
/** Signed logarithmic scale inputs. See {@link LinearScaleProps}. */
export interface SymlogScaleProps extends LinearScaleProps {
  /** Positive linear-to-log transition constant in domain units, default 1. */
  readonly constant?: SignalValue<number>;
}
/** Signed logarithmic mapping through zero. See {@link ResolvedLinearScale}. */
export interface ResolvedSymlogScale extends Omit<ResolvedLinearScale, "type"> {
  /** Signed logarithmic discriminant. See {@link SymlogScaleProps}. */
  readonly type: "symlog";
  /** Positive transition constant. See {@link SymlogScaleProps}. */
  readonly constant: number;
}
/** Equally spaced categorical positions. See {@link LinearScaleProps}. */
export interface PointScaleProps extends Omit<LinearScaleProps, "domain"> {
  /** Ordered unique string or finite numeric categories; accepts signals. See {@link BandDomain}. */
  readonly domain: SignalValue<BandDomain>;
  /** Nonnegative outer padding in step units, default 0. */
  readonly padding?: SignalValue<number>;
}
/** Zero-width categorical point positions. See {@link ResolvedBandScale}. */
export interface ResolvedPointScale extends Omit<
  ResolvedBandScale,
  "type" | "bandwidth"
> {
  /** Categorical point discriminant. See {@link PointScaleProps}. */
  readonly type: "point";
  /** Resolved outer padding. See {@link PointScaleProps}. */
  readonly padding: number;
  /**
   * Finds the nearest category, clamping outside coordinates; ties choose first domain order.
   * @param pixel - Finite range coordinate.
   * @returns Category or undefined for an empty domain. See {@link BandCategory}.
   */
  invert(pixel: number): BandCategory | undefined;
  /**
   * Selects evenly spaced categories including endpoints when count permits.
   * @param count - Integer maximum count 0–100, default 5.
   * @returns Frozen categories in domain order. See {@link BandDomain}.
   */
  ticks(count?: number): BandDomain;
}

import type {
  PibblEventHandlers,
  PibblEventParticipationOptions,
  FillStyle,
  StrokeStyle,
} from "@pibbl/core";
/**
 * Supported geometry and presentation properties for Axis.
 *
 * @see {@link StrokeStyle}
 * @see {@link FillStyle}
 */
export interface AxisStyle {
  /** Paint used for the outline. See {@link StrokeStyle}. */
  readonly stroke?: StrokeStyle;
  /** Width of the painted outline. See {@link AxisStyle}. */
  readonly strokeWidth?: number;
  /** Paint used for the interior. See {@link FillStyle}. */
  readonly fill?: FillStyle;
  /** Canvas font string used to draw or measure text. See {@link AxisStyle}. */
  readonly font?: string;
  /** Opacity of the painted result. See {@link AxisStyle}. */
  readonly opacity?: number;
}
/**
 * Named scale, edge placement, label formatter, and paint shared by axis tick variants.
 *
 * @see {@link ScaleId}
 * @see {@link AxisStyle}
 */
interface AxisBaseProps {
  /** Identifier of the scale whose domain and range define the axis. See {@link ScaleId}. */
  readonly scale: ScaleId;
  /** Position of the geometry, source, or selected resize handle. See {@link AxisBaseProps}. */
  readonly position: "bottom" | "left" | "top" | "right";
  /**
   * Formats a tick's domain value for display as a label. See {@link AxisBaseProps}.
   * @param value - Numeric domain value or band category for the tick.
   * @param index - Zero-based tick index.
   * @returns Text to draw for the tick label.
   */
  readonly tickFormat?: (value: number | string, index: number) => string;
  /** Label collision policy; allow preserves all labels (default), skip measures and omits overlaps without removing ticks. */
  readonly labelOverlap?: SignalValue<"allow" | "skip">;
  /** Minimum distance between visible labels in logical pixels; defaults to 8. */
  readonly labelGap?: SignalValue<number>;
  /** Long-label policy, default allow. Wrap/truncate require labelMaxWidth; coordinates remain unchanged. */
  readonly labelOverflow?: SignalValue<"allow" | "wrap" | "truncate">;
  /** Maximum measured line width in logical pixels, positive and finite. Required for wrap/truncate. */
  readonly labelMaxWidth?: SignalValue<number>;
  /** Maximum wrapped lines, integer 1–20; default 2. Excess text receives an ellipsis. */
  readonly labelMaxLines?: SignalValue<number>;
  /** Positive line advance in logical pixels; default is measured font height plus 4. */
  readonly labelLineHeight?: SignalValue<number>;
  /**
   * Declared presentation and layout properties. See {@link SignalValue}, {@link SignalStyle},
   * {@link AxisStyle}.
   */
  readonly style?: SignalValue<SignalStyle<AxisStyle>>;
}
/**
 * Authored inputs for Axis, including the declared data and presentation options.
 *
 * @see {@link SignalValue}
 * @see {@link Axis}
 */
export type AxisProps = AxisBaseProps &
  (
    | {
        /** Explicit values at which axis ticks and labels are drawn. See {@link SignalValue}. */
        readonly tickValues: SignalValue<readonly (number | string)[]>;
        /** Not accepted in this variant; use the alternative fields instead. See {@link AxisProps}. */
        readonly tickCount?: never;
      }
    | {
        /** Not accepted in this variant; use the alternative fields instead. See {@link AxisProps}. */
        readonly tickValues?: never;
        /** Requested number of generated axis ticks. See {@link SignalValue}. */
        readonly tickCount?: SignalValue<number>;
      }
  );

/**
 * A numeric series coordinate, or a missing value that can create a gap.
 *
 * @see {@link LineAccessor}
 */
export type LineCoordinate = number | null | undefined;
/**
 * A data property or callback that extracts a numeric series coordinate.
 *
 * @param datum - Datum whose coordinate is being read.
 * @param index - Zero-based index in the source data.
 * @param data - Complete source data array.
 * @returns The datum's coordinate, including the supported missing-value sentinel. See
 * {@link LineCoordinate} .
 *
 * @see {@link LineCoordinate}
 * @see {@link LineSeriesProps}
 * @see {@link PointAccessor}
 */
export type LineAccessor<D> =
  | { [K in keyof D]-?: D[K] extends LineCoordinate ? K : never }[keyof D]
  | ((datum: D, index: number, data: readonly D[]) => LineCoordinate);
/** A numeric or categorical position, or a missing value. @see {@link SeriesAccessor} */
export type SeriesCoordinate = number | string | null | undefined;
/**
 * Extracts one position for a line, point, or custom mark.
 * @param datum - Original record.
 * @param index - Original record index.
 * @param data - Complete source records.
 * @returns A numeric or categorical position. See {@link SeriesCoordinate}.
 * @see {@link LineSeriesProps}
 */
export type SeriesAccessor<D> =
  | { [K in keyof D]-?: D[K] extends SeriesCoordinate ? K : never }[keyof D]
  | ((datum: D, index: number, data: readonly D[]) => SeriesCoordinate);
/**
 * The supported interpolation mode for a line series.
 *
 * @see {@link LineSeriesProps}
 */
export type LineCurve = "linear" | SeriesCurve;
/**
 * Supported geometry and presentation properties for LineSeries.
 *
 * @see {@link StrokeStyle}
 * @see {@link LineSeriesProps}
 */
export interface LineSeriesStyle {
  /** Paint used for the outline. See {@link StrokeStyle}. */
  readonly stroke?: StrokeStyle;
  /** Width of the painted outline. See {@link LineSeriesStyle}. */
  readonly strokeWidth?: number;
  /** Opacity of the painted result. See {@link LineSeriesStyle}. */
  readonly opacity?: number;
  /** Cursor shown while this target owns pointer presentation. See {@link LineSeriesStyle}. */
  readonly cursor?: string;
  /**
   * Width used for line hit testing independently of the visible stroke width. See
   * {@link LineSeriesStyle}.
   */
  readonly lineInteractionWidth?: number;
}
/**
 * Authored inputs for LineSeries, including the declared data and presentation options.
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblEventParticipationOptions}
 * @see {@link SignalValue}
 * @see {@link LineAccessor}
 * @see {@link ScaleId}
 * @see {@link LineCurve}
 * @see {@link SignalStyle}
 * @see {@link LineSeriesStyle}
 */
export interface LineSeriesProps<D>
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /**
   * Application data supplied to the component or reported by the event. See {@link SignalValue}.
   */
  readonly data: SignalValue<readonly D[]>;
  /** Optional committed numeric observation capture; no query execution during paint. */
  readonly inspection?: import("../inspection/capture-types.js").NumericInspectionRef<D>;
  /** Property key or callback extracting the horizontal domain coordinate. See {@link LineAccessor}. */
  readonly x: SeriesAccessor<D>;
  /** Property key or callback extracting the vertical domain coordinate. See {@link LineAccessor}. */
  readonly y: SeriesAccessor<D>;
  /** The scale used to map horizontal data coordinates. See {@link ScaleId}. */
  readonly xScale: ScaleId;
  /** The scale used to map vertical data coordinates. See {@link ScaleId}. */
  readonly yScale: ScaleId;
  /**
   * Returns whether a datum contributes drawable or queryable coordinates. See
   * {@link LineSeriesProps}.
   * @param datum - Datum to test.
   * @param index - Zero-based index in the source data.
   * @param data - Complete source data array.
   * @returns Whether this datum should participate in the series or query.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  /** Interpolation mode used to connect successive defined samples. See {@link LineCurve}. */
  readonly curve?: LineCurve;
  /**
   * Declared presentation and layout properties. See {@link SignalValue}, {@link SignalStyle},
   * {@link LineSeriesStyle}.
   */
  readonly style?: SignalValue<SignalStyle<LineSeriesStyle>>;
}
/**
 * Pairs a horizontal data coordinate with its scale, or omits both.
 *
 * @see {@link ScaleId}
 * @see {@link ScaleAdjustProps}
 */
type ScaleAdjustX =
  | {
      /**
       * Horizontal coordinate or displacement in the containing coordinate system. See
       * {@link SignalValue}.
       */
      readonly x: SignalValue<BandCategory>;
      /** The scale used to map horizontal data coordinates. See {@link ScaleId}. */
      readonly xScale: ScaleId;
    }
  | {
      /** Not accepted in this variant; use the alternative fields instead. See {@link ScaleAdjustX}. */
      readonly x?: never;
      /** Not accepted in this variant; use the alternative fields instead. See {@link ScaleAdjustX}. */
      readonly xScale?: never;
    };
/**
 * Pairs a vertical data coordinate with its scale, or omits both.
 *
 * @see {@link ScaleId}
 * @see {@link ScaleAdjustProps}
 */
type ScaleAdjustY =
  | {
      /**
       * Vertical coordinate or displacement in the containing coordinate system. See
       * {@link SignalValue}.
       */
      readonly y: SignalValue<BandCategory>;
      /** The scale used to map vertical data coordinates. See {@link ScaleId}. */
      readonly yScale: ScaleId;
    }
  | {
      /** Not accepted in this variant; use the alternative fields instead. See {@link ScaleAdjustY}. */
      readonly y?: never;
      /** Not accepted in this variant; use the alternative fields instead. See {@link ScaleAdjustY}. */
      readonly yScale?: never;
    };
/**
 * Authored inputs for ScaleAdjust, including the declared data and presentation options.
 *
 * @see {@link PibblNode}
 * @see {@link ScaleAdjust}
 */
export type ScaleAdjustProps = ScaleAdjustX &
  ScaleAdjustY & {
    /** Descendant content or the callback that supplies it. See {@link PibblNode}. */
    readonly children?: PibblNode;
  };
