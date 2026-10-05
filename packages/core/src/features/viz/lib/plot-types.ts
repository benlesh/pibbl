import type { PlotSeries } from './plot-series.js';
import type { PieOptions } from './pie-slices.js';
import type { CRCEventHandlers, CRCNode, SignalValue } from "@crc/core";
import type { PointAccessor } from "./point-types.js";
import type { ScaleId } from "./types.js";
/**
 * A property or callback that provides stable identity for a plotted datum.
 *
 * @param datum - Datum requiring an identity.
 * @param index - Zero-based index in the source data.
 * @param data - Complete source data array.
 * @returns A stable string or numeric key for the datum.
 *
 * @see {@link PlotSeriesProps}
 * @see {@link PieOptions}
 */
export type PlotKeyAccessor<D> =
  | { [K in keyof D]-?: D[K] extends string | number ? K : never }[keyof D]
  | ((datum: D, index: number, data: readonly D[]) => string | number);
/**
 * Authored inputs for PlotSeries, including the declared data and presentation options.
 *
 * @see {@link CRCEventHandlers}
 * @see {@link SignalValue}
 * @see {@link PointAccessor}
 * @see {@link ScaleId}
 * @see {@link PlotKeyAccessor}
 * @see {@link CRCNode}
 * @see {@link PlotSeries}
 */
export interface PlotSeriesProps<D> extends CRCEventHandlers {
  /**
   * Application data supplied to the component or reported by the event. See {@link SignalValue}.
   */
  readonly data: SignalValue<readonly D[]>;
  /** Property key or callback extracting the horizontal domain coordinate. See {@link PointAccessor}. */
  readonly x: PointAccessor<D>;
  /** Property key or callback extracting the vertical domain coordinate. See {@link PointAccessor}. */
  readonly y: PointAccessor<D>;
  /** The scale used to map horizontal data coordinates. See {@link ScaleId}. */
  readonly xScale: ScaleId;
  /** The scale used to map vertical data coordinates. See {@link ScaleId}. */
  readonly yScale: ScaleId;
  /**
   * Returns whether a datum contributes drawable or queryable coordinates. See
   * {@link PlotSeriesProps}.
   * @param datum - Datum to test.
   * @param index - Zero-based index in the source data.
   * @param data - Complete source data array.
   * @returns Whether this datum should participate in the series or query.
   */
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  /** Property or callback supplying stable identity for each datum. See {@link PlotKeyAccessor}. */
  readonly keyBy?: PlotKeyAccessor<D>;
  /**
   * Renders the current data or resources using the supplied context. See {@link CRCNode}.
   * @param datum - Datum to render.
   * @param index - Zero-based index in the source data.
   * @param data - Complete source data array.
   * @returns CRC content to place at the datum's mapped coordinates. See {@link CRCNode}.
   */
  readonly render: (datum: D, index: number, data: readonly D[]) => CRCNode;
}
