import type { SeriesAccessor } from "./types.js";
import type { PlotSeriesProps } from "./plot-types.js";
import type {
  PibblEventHandlers,
  PibblEventParticipationOptions,
  FillStyle,
  SignalValue,
  StrokeStyle,
} from "@pibbl/core";
import type { SignalStyle } from "@pibbl/core/internal";
import type { LineAccessor, ScaleId } from "./types.js";
/**
 * A data property or callback extracting a point coordinate.
 *
 * @see {@link LineAccessor}
 * @see {@link PointSeriesProps}
 * @see {@link PlotSeriesProps}
 */
export type PointAccessor<D> = LineAccessor<D>;
/**
 * Radius and paint applied to an individual plotted point.
 *
 * @see {@link FillStyle}
 * @see {@link StrokeStyle}
 * @see {@link PointSeriesStyle}
 * @see {@link PointStyleResolver}
 */
export interface PointMarkStyle {
  /** Radius in the coordinate system of this geometry or effect. See {@link PointMarkStyle}. */
  readonly radius?: number;
  /** Paint used for the interior. See {@link FillStyle}. */
  readonly fill?: FillStyle;
  /** Paint used for the outline. See {@link StrokeStyle}. */
  readonly stroke?: StrokeStyle;
  /** Width of the painted outline. See {@link PointMarkStyle}. */
  readonly strokeWidth?: number;
  /** Opacity of the painted result. See {@link PointMarkStyle}. */
  readonly opacity?: number;
}
/**
 * Supported geometry and presentation properties for PointSeries.
 *
 * @see {@link PointMarkStyle}
 * @see {@link PointSeriesProps}
 */
export interface PointSeriesStyle extends PointMarkStyle {
  /** Cursor shown while this target owns pointer presentation. See {@link PointSeriesStyle}. */
  readonly cursor?: string;
}
/**
 * Computes per-datum point styling from the datum, index, and source data.
 *
 * @param datum - Datum being styled.
 * @param index - Zero-based index in the source data.
 * @param data - Complete source data array.
 * @returns Paint and radius overrides for this point. See {@link PointMarkStyle}.
 *
 * @see {@link PointMarkStyle}
 * @see {@link PointSeriesProps}
 */
export type PointStyleResolver<D> = (
  datum: D,
  index: number,
  data: readonly D[],
) => Readonly<PointMarkStyle>;
/**
 * Authored inputs for PointSeries, including the declared data and presentation options.
 *
 * @see {@link PibblEventHandlers}
 * @see {@link PibblEventParticipationOptions}
 * @see {@link SignalValue}
 * @see {@link PointAccessor}
 * @see {@link ScaleId}
 * @see {@link SignalStyle}
 * @see {@link PointSeriesStyle}
 * @see {@link PointStyleResolver}
 */
export interface PointSeriesProps<D>
  extends PibblEventHandlers, PibblEventParticipationOptions {
  /**
   * Application data supplied to the component or reported by the event. See {@link SignalValue}.
   */
  readonly data: SignalValue<readonly D[]>;
  /** Optional committed numeric inspection capture; rendering alone performs no queries. */
  readonly inspection?: import("../inspection/capture-types.js").NumericInspectionRef<D>;
  /** Property key or callback extracting the horizontal domain coordinate. See {@link PointAccessor}. */
  readonly x: SeriesAccessor<D>;
  /** Property key or callback extracting the vertical domain coordinate. See {@link PointAccessor}. */
  readonly y: SeriesAccessor<D>;
  /** The scale used to map horizontal data coordinates. See {@link ScaleId}. */
  readonly xScale: ScaleId;
  /** The scale used to map vertical data coordinates. See {@link ScaleId}. */
  readonly yScale: ScaleId;
  /**
   * Returns whether a datum contributes drawable or queryable coordinates. See
   * {@link PointSeriesProps}.
   * @param datum - Datum to test.
   * @param index - Zero-based index in the source data.
   * @param data - Complete source data array.
   * @returns Whether this datum should participate in the series or query.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  /**
   * Declared presentation and layout properties. See {@link SignalValue}, {@link SignalStyle},
   * {@link PointSeriesStyle}, {@link PointStyleResolver}.
   */
  readonly style?: SignalValue<
    SignalStyle<PointSeriesStyle> | PointStyleResolver<D>
  >;
}
