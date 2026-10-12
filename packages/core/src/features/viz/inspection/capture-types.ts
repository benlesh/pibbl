import type {
  NumericRenderedSeries,
  RenderedSeriesPoint,
} from "./query-types.js";

/** Values evaluated by a numeric series, before applying its world transform. */
export interface CapturedNumericObservation<D> {
  /** Original caller-owned record. */
  readonly datum: D;
  /** Original zero-based source position, including skipped rows. */
  readonly sourceIndex: number;
  /** Horizontal data-space value. */
  readonly domainX: number;
  /** Vertical data-space value. */
  readonly domainY: number;
  /** Local logical anchor before world transforms. */
  readonly anchorLocal: Readonly<RenderedSeriesPoint>;
  /** Contiguous valid run identity; interpolation cannot cross runs. */
  readonly run: number;
  /** Optional local circle radius captured for discrete point geometry. */
  readonly radiusLocal?: number;
  /** Whether the mark has geometric fill coverage. */
  readonly fill?: boolean;
  /** Local painted stroke width, zero when absent. */
  readonly strokeWidthLocal?: number;
}

/** Structural capture input used by renderers; no query is executed by capture. */
export interface NumericSeriesCapture<D> {
  /** Evaluated values and geometry owned by this candidate generation. */
  readonly observations: readonly CapturedNumericObservation<D>[];
  /** Captured numeric x mapping and inversion. */
  readonly xScale: import("../lib/series-position.js").NumericPositionScale;
  /** Captured numeric y mapping for explicit interpolation anchors. */
  readonly yScale: import("../lib/series-position.js").NumericPositionScale;
}

/** Optional renderer sink and mount-owned access to the last successful paint.
 * @see {@link NumericRenderedSeries}
 */
export interface NumericInspectionRef<D> {
  /** Returns borrowed rendered values.
   * @returns Current committed generation, or undefined before paint/after disposal.
   */
  rendered(): NumericRenderedSeries<D> | undefined;
  /** @internal Records a candidate; publishes only after successful root rendering.
   * @param input - Values evaluated by the receiver in source order.
   */
  capture(input: NumericSeriesCapture<D>): void;
}

/** Rendered numeric points with committed circle/ring geometry.
 * @see {@link NumericRenderedSeries}
 */
export interface PointRenderedSeries<D> extends NumericRenderedSeries<D> {
  /** @internal Borrowed geometry corresponding to observations in source order. */
  readonly marks: readonly CapturedNumericObservation<D>[];
  /** @internal Maps a root-logical point to this committed local frame.
   * @param point - Root-logical Canvas coordinates.
   * @returns Local coordinates, or undefined for a singular transform.
   */
  localAtRoot(
    point: Readonly<RenderedSeriesPoint>,
  ): Readonly<RenderedSeriesPoint> | undefined;
}

/** Mount-owned point capture; queries are imported independently.
 * @see {@link PointRenderedSeries}
 */
export interface PointInspectionRef<D> extends NumericInspectionRef<D> {
  /** Returns borrowed point geometry.
   * @returns Current point generation, or undefined before paint/after disposal.
   */
  rendered(): PointRenderedSeries<D> | undefined;
}
